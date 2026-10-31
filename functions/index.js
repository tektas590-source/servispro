/* ServisPro — Cloud Functions (abonelik ve ödeme)
 *
 *  startSubscription   (callable) : iyzico abonelik ödeme formunu başlatır
 *  iyzicoCallback      (http)     : kart ödemesinden sonra iyzico buraya döner → aboneliği aktif eder
 *  iyzicoWebhook       (http)     : her ay yenilemede iyzico bildirim gönderir → durumu günceller
 *  changePlan          (callable) : paket yükseltme / düşürme
 *  cancelSubscription  (callable) : aboneliği iptal eder
 *
 * Güvenlik: abonelik alanları (plan, status, currentPeriodEnd, iyzico) yalnızca buradan yazılır;
 * Firestore kuralları istemcinin bu alanları değiştirmesini engeller. Webhook'tan gelen bilgiye
 * doğrudan güvenilmez, abonelik durumu her seferinde iyzico API'den tekrar sorgulanır.
 */
const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { setGlobalOptions, logger } = require('firebase-functions/v2');
const { defineSecret, defineString } = require('firebase-functions/params');
const admin = require('firebase-admin');
const iyzico = require('./iyzico');

admin.initializeApp();
const db = admin.firestore();
const { Timestamp, FieldValue } = admin.firestore;

setGlobalOptions({ region: 'europe-west1', maxInstances: 10 });

const IYZICO_API_KEY = defineSecret('IYZICO_API_KEY');
const IYZICO_SECRET_KEY = defineSecret('IYZICO_SECRET_KEY');
const IYZICO_BASE_URL = defineString('IYZICO_BASE_URL', { default: 'https://sandbox-api.iyzipay.com' });
const APP_URL = defineString('APP_URL', { description: 'Uygulamanın adresi, ör. https://servispro.web.app' });
const PLAN_BASLANGIC = defineString('PLAN_BASLANGIC', { description: 'iyzico Başlangıç ödeme planı referans kodu' });
const PLAN_PROFESYONEL = defineString('PLAN_PROFESYONEL', { description: 'iyzico Profesyonel ödeme planı referans kodu' });
const PLAN_KURUMSAL = defineString('PLAN_KURUMSAL', { description: 'iyzico Kurumsal ödeme planı referans kodu' });
const secrets = [IYZICO_API_KEY, IYZICO_SECRET_KEY];

const planRefs = () => ({ baslangic: PLAN_BASLANGIC.value(), profesyonel: PLAN_PROFESYONEL.value(), kurumsal: PLAN_KURUMSAL.value() });
const planFromRef = (ref) => Object.entries(planRefs()).find(([, v]) => v === ref)?.[0] || null;
const api = () => iyzico.client({ apiKey: IYZICO_API_KEY.value(), secretKey: IYZICO_SECRET_KEY.value(), baseUrl: IYZICO_BASE_URL.value() });
const appUrl = () => APP_URL.value().replace(/\/$/, '');
const addMonth = (d = new Date()) => { const x = new Date(d); x.setMonth(x.getMonth() + 1); x.setDate(x.getDate() + 1); return x; };

// Çağıranın servis sahibi olduğunu doğrular, tenant'ı döndürür
async function ownerTenant(request) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  const u = await db.doc(`users/${request.auth.uid}`).get();
  if (!u.exists || !u.data().tenantId) throw new HttpsError('failed-precondition', 'Hesabınız bir servise bağlı değil.');
  if (u.data().role !== 'owner') throw new HttpsError('permission-denied', 'Bu işlemi yalnızca servis sahibi yapabilir.');
  const ref = db.doc(`tenants/${u.data().tenantId}`);
  const t = await ref.get();
  return { ref, tenant: t.data(), tenantId: t.id };
}
const fail = (e) => { logger.error(e.message, e.iyzico || ''); throw e instanceof HttpsError ? e : new HttpsError('internal', e.message || 'Ödeme sağlayıcısı hatası'); };

/* ------------------------------------------------------------ Abone ol */
exports.startSubscription = onCall({ secrets }, async (request) => {
  const { ref, tenant, tenantId } = await ownerTenant(request);
  const { planId, buyer = {} } = request.data || {};
  const pricingPlanReferenceCode = planRefs()[planId];
  if (!pricingPlanReferenceCode) throw new HttpsError('invalid-argument', 'Geçersiz paket.');
  if (tenant.status === 'active') throw new HttpsError('failed-precondition', 'Zaten aktif aboneliğiniz var. Paket değiştirmeyi kullanın.');
  for (const k of ['name', 'surname', 'identityNumber', 'gsmNumber', 'email', 'city', 'address']) {
    if (!String(buyer[k] || '').trim()) throw new HttpsError('invalid-argument', 'Fatura bilgileri eksik: ' + k);
  }
  let gsm = String(buyer.gsmNumber).replace(/[^\d+]/g, '');
  if (gsm.startsWith('0')) gsm = '+9' + gsm; else if (!gsm.startsWith('+')) gsm = '+90' + gsm;
  const address = { contactName: `${buyer.name} ${buyer.surname}`, city: buyer.city, country: 'Turkey', address: buyer.address, zipCode: buyer.zipCode || '00000' };
  try {
    const r = await api().initCheckout({
      locale: 'tr', conversationId: tenantId,
      callbackUrl: `${appUrl()}/api/iyzico/callback`,
      pricingPlanReferenceCode, subscriptionInitialStatus: 'ACTIVE',
      customer: { name: buyer.name, surname: buyer.surname, identityNumber: String(buyer.identityNumber).trim(), email: buyer.email, gsmNumber: gsm, billingAddress: address, shippingAddress: address },
    });
    await db.doc(`checkoutSessions/${r.token}`).set({ tenantId, planId, uid: request.auth.uid, createdAt: FieldValue.serverTimestamp() });
    await ref.update({ billingContact: { name: buyer.name, surname: buyer.surname, email: buyer.email, city: buyer.city } });
    return { checkoutFormContent: r.checkoutFormContent, token: r.token };
  } catch (e) { fail(e); }
});

/* ------------------------------------------------------------ Ödeme dönüşü */
exports.iyzicoCallback = onRequest({ secrets }, async (req, res) => {
  const token = (req.body && req.body.token) || req.query.token;
  const back = (ok, msg) => res.redirect(302, `${appUrl()}/#abonelik?durum=${ok ? 'ok' : 'hata'}${msg ? '&mesaj=' + encodeURIComponent(msg) : ''}`);
  if (!token) return back(false, 'Ödeme bilgisi bulunamadı');
  try {
    const s = await db.doc(`checkoutSessions/${token}`).get();
    if (!s.exists) return back(false, 'Oturum bulunamadı');
    const { tenantId, planId } = s.data();
    const r = await api().checkoutResult(token);
    const d = r.data || {};
    if (d.subscriptionStatus && !['ACTIVE', 'PENDING'].includes(d.subscriptionStatus)) return back(false, 'Ödeme onaylanmadı');
    await db.doc(`tenants/${tenantId}`).update({
      plan: planFromRef(d.pricingPlanReferenceCode) || planId,
      status: 'active',
      currentPeriodEnd: Timestamp.fromDate(addMonth()),
      iyzico: { subscriptionRef: d.referenceCode || null, customerRef: d.customerReferenceCode || null, pricingPlanRef: d.pricingPlanReferenceCode || null },
      activatedAt: FieldValue.serverTimestamp(),
    });
    await s.ref.delete();
    return back(true);
  } catch (e) {
    logger.error('callback', e.message, e.iyzico || '');
    return back(false, e.message);
  }
});

/* ------------------------------------------------------------ Aylık yenileme bildirimi
 * iyzico Merchant Panel > Ayarlar > Bildirimler: webhook adresi = APP_URL/api/iyzico/webhook
 */
exports.iyzicoWebhook = onRequest({ secrets }, async (req, res) => {
  const b = req.body || {};
  const subRef = b.subscriptionReferenceCode;
  logger.info('webhook', b.iyziEventType, subRef);
  if (!subRef) { res.status(200).send('ok'); return; }
  try {
    const q = await db.collection('tenants').where('iyzico.subscriptionRef', '==', subRef).limit(1).get();
    if (q.empty) { res.status(200).send('ok'); return; }
    const ref = q.docs[0].ref;
    // Bildirimin içeriğine güvenmeden gerçek durumu iyzico'dan sorgula
    const s = (await api().getSubscription(subRef)).data || {};
    const item = Array.isArray(s.items) ? s.items[0] : s;
    const status = item.subscriptionStatus;
    const upd = { lastWebhookAt: FieldValue.serverTimestamp(), lastEvent: b.iyziEventType || null };
    if (status === 'ACTIVE') {
      upd.status = 'active';
      const paid = (item.orders || []).filter((o) => o.orderStatus === 'SUCCESS').sort((a, c) => (c.endPeriod || 0) - (a.endPeriod || 0))[0];
      upd.currentPeriodEnd = Timestamp.fromDate(paid && paid.endPeriod ? new Date(Number(paid.endPeriod)) : addMonth());
    } else if (status === 'UNPAID') upd.status = 'past_due';
    else if (status === 'CANCELED' || status === 'EXPIRED') upd.status = 'canceled';
    const plan = planFromRef(item.pricingPlanReferenceCode);
    if (plan) upd.plan = plan;
    await ref.update(upd);
    res.status(200).send('ok');
  } catch (e) {
    logger.error('webhook', e.message, e.iyzico || '');
    res.status(500).send('error'); // iyzico tekrar dener
  }
});

/* ------------------------------------------------------------ Paket değiştir */
exports.changePlan = onCall({ secrets }, async (request) => {
  const { ref, tenant } = await ownerTenant(request);
  const newRef = planRefs()[request.data && request.data.planId];
  if (!newRef) throw new HttpsError('invalid-argument', 'Geçersiz paket.');
  if (tenant.status !== 'active' || !tenant.iyzico?.subscriptionRef) throw new HttpsError('failed-precondition', 'Aktif abonelik yok.');
  try {
    const r = await api().upgrade(tenant.iyzico.subscriptionRef, newRef);
    const d = r.data || {};
    await ref.update({ plan: request.data.planId, 'iyzico.pricingPlanRef': newRef, ...(d.referenceCode ? { 'iyzico.subscriptionRef': d.referenceCode } : {}) });
    return { ok: true };
  } catch (e) { fail(e); }
});

/* ------------------------------------------------------------ İptal */
exports.cancelSubscription = onCall({ secrets }, async (request) => {
  const { ref, tenant } = await ownerTenant(request);
  if (!tenant.iyzico?.subscriptionRef) throw new HttpsError('failed-precondition', 'Aktif abonelik yok.');
  try {
    await api().cancel(tenant.iyzico.subscriptionRef);
    await ref.update({ status: 'canceled', canceledAt: FieldValue.serverTimestamp() });
    return { ok: true };
  } catch (e) { fail(e); }
});
