/* Veri katmanı — iki uygulama, aynı arayüz:
 *  - DemoAPI: tarayıcı hafızası (localStorage). firebaseConfig boşken kullanılır.
 *  - FirebaseAPI: Firebase Auth + Firestore + Cloud Functions (canlı ürün).
 * Her servis (kiracı/tenant) verisi tenants/{tenantId}/{koleksiyon} altında tutulur.
 */
(function () {
  const SP = window.SP;
  const COLLECTIONS = ['customers', 'vehicles', 'appointments', 'workorders', 'parts', 'stockMoves', 'invoices', 'payments'];
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const nowIso = () => new Date().toISOString();
  const addDays = (d, n) => new Date(d.getTime() + n * 86400000);
  const errTR = (code) => ({
    'auth/email-already-in-use': 'Bu e-posta ile zaten bir hesap var.',
    'auth/invalid-email': 'E-posta adresi geçersiz.',
    'auth/weak-password': 'Şifre en az 6 karakter olmalı.',
    'auth/invalid-credential': 'E-posta veya şifre hatalı.',
    'auth/wrong-password': 'E-posta veya şifre hatalı.',
    'auth/user-not-found': 'E-posta veya şifre hatalı.',
    'auth/too-many-requests': 'Çok fazla deneme yapıldı, biraz sonra tekrar deneyin.',
    'permission-denied': 'Bu işlem için yetkiniz yok veya aboneliğiniz aktif değil.',
  }[code]);
  const wrapErr = (e) => { const m = errTR(e && e.code); if (m) { const x = new Error(m); x.code = e.code; return x; } return e; };

  /* ------------------------------------------------------------------ DEMO */
  function DemoAPI() {
    const KEY = 'servispro_demo_v1';
    let mem = null; // localStorage yoksa hafızada tut
    const load = () => {
      try { const s = localStorage.getItem(KEY); if (s) return JSON.parse(s); } catch (_) { if (mem) return mem; }
      return mem || { users: {}, profiles: {}, tenants: {}, data: {}, invites: {}, session: null };
    };
    let st = load();
    const save = () => { mem = st; try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (_) { /* gizli sekme */ } };
    let listeners = [];
    const emit = () => listeners.forEach((cb) => cb(api.currentUser()));
    const tid = () => SP.session && SP.session.tenant && SP.session.tenant.id;
    const coll = (c) => { const t = tid(); st.data[t] = st.data[t] || {}; st.data[t][c] = st.data[t][c] || {}; return st.data[t][c]; };
    const delay = (v) => new Promise((r) => setTimeout(() => r(v), 60));

    const api = {
      isDemo: true,
      async init() { if (!Object.keys(st.users).length) seedDemo(st); save(); },
      onAuthChange(cb) { listeners = [cb]; cb(api.currentUser()); },
      currentUser() { const e = st.session; if (!e || !st.users[e]) return null; const u = st.users[e]; return { uid: u.uid, email: e, name: u.name }; },
      async register({ name, email, password, company, phone }) {
        email = email.toLowerCase().trim();
        if (st.users[email]) throw new Error(errTR('auth/email-already-in-use'));
        if (!password || password.length < 6) throw new Error(errTR('auth/weak-password'));
        const u = { uid: uid(), name, password };
        st.users[email] = u;
        const inv = st.invites[email];
        if (inv) { st.profiles[u.uid] = { tenantId: inv.tenantId, role: inv.role, name, email }; delete st.invites[email]; }
        else {
          const t = newTenant(u.uid, company, phone, email);
          st.tenants[t.id] = t;
          st.profiles[u.uid] = { tenantId: t.id, role: 'owner', name, email };
        }
        st.session = email; save(); emit();
      },
      async login(email, password) {
        email = email.toLowerCase().trim();
        const u = st.users[email];
        if (!u || u.password !== password) throw new Error(errTR('auth/invalid-credential'));
        st.session = email; save(); emit();
      },
      async logout() { st.session = null; save(); emit(); },
      async resetPassword() { return delay(true); },
      async loadSession(user) {
        const p = st.profiles[user.uid];
        if (!p || !p.tenantId) return { profile: p || null, tenant: null };
        const t = st.tenants[p.tenantId];
        return { profile: p, tenant: t ? { ...t } : null };
      },
      async list(c) { return delay(Object.values(coll(c)).map((x) => ({ ...x }))); },
      async get(c, id) { const x = coll(c)[id]; return delay(x ? { ...x } : null); },
      async add(c, data) { const id = uid(); coll(c)[id] = { ...data, id, createdAt: nowIso(), updatedAt: nowIso() }; save(); return delay(id); },
      async update(c, id, data) { const x = coll(c)[id]; if (!x) throw new Error('Kayıt bulunamadı'); Object.assign(x, data, { updatedAt: nowIso() }); save(); return delay(true); },
      async remove(c, id) { delete coll(c)[id]; save(); return delay(true); },
      async nextNo(key) {
        const t = st.tenants[tid()]; t.counters = t.counters || {};
        t.counters[key] = (t.counters[key] || 0) + 1; save(); return t.counters[key];
      },
      async updateTenant(data) { Object.assign(st.tenants[tid()], data); save(); SP.session.tenant = { ...st.tenants[tid()] }; },
      async members() {
        const t = tid();
        const users = Object.values(st.profiles).filter((p) => p.tenantId === t).map((p) => ({ ...p, uid: Object.keys(st.profiles).find((k) => st.profiles[k] === p) }));
        const invites = Object.entries(st.invites).filter(([, v]) => v.tenantId === t).map(([email, v]) => ({ email, ...v }));
        return { users, invites };
      },
      async invite(email, role) { st.invites[email.toLowerCase().trim()] = { tenantId: tid(), role, createdAt: nowIso() }; save(); },
      async revokeInvite(email) { delete st.invites[email]; save(); },
      async removeMember(memberUid) { if (st.profiles[memberUid]) st.profiles[memberUid].tenantId = null; save(); },
      // Demo modunda ödeme simüle edilir
      async startCheckout(planId) {
        const t = st.tenants[tid()];
        Object.assign(t, { plan: planId, status: 'active', currentPeriodEnd: addDays(new Date(), 30).toISOString(), iyzico: { subscriptionRef: 'DEMO-' + uid() } });
        save(); SP.session.tenant = { ...t };
        return { demoActivated: true };
      },
      async changePlan(planId) { const t = st.tenants[tid()]; t.plan = planId; save(); SP.session.tenant = { ...t }; },
      async cancelSubscription() { const t = st.tenants[tid()]; t.status = 'canceled'; save(); SP.session.tenant = { ...t }; },
      async adminTenants() { return Object.values(st.tenants).map((t) => ({ ...t })); },
      resetDemo() { try { localStorage.removeItem(KEY); } catch (_) {} mem = null; st = load(); seedDemo(st); save(); },
    };
    return api;
  }

  function newTenant(ownerUid, company, phone, email) {
    return {
      id: uid(), name: company || 'Servisim', phone: phone || '', email: email || '', address: '', taxOffice: '', taxNo: '',
      ownerUid, plan: 'profesyonel', status: 'trial', createdAt: nowIso(),
      trialEndsAt: addDays(new Date(), SP.config.trialDays).toISOString(), counters: {},
    };
  }

  /* Demo verisi */
  function seedDemo(st) {
    const u = { uid: 'demo-owner', name: 'Ahmet Usta', password: 'demo123' };
    st.users['demo@servispro.com'] = u;
    const t = newTenant(u.uid, 'Demo Oto Servis', '0362 000 00 00', 'demo@servispro.com');
    t.id = 'demo-tenant'; t.address = 'Sanayi Sitesi 4. Blok No:12, Samsun'; t.taxOffice = 'Samsun'; t.taxNo = '1234567890';
    t.trialEndsAt = addDays(new Date(), 11).toISOString();
    st.tenants[t.id] = t;
    st.profiles[u.uid] = { tenantId: t.id, role: 'owner', name: u.name, email: 'demo@servispro.com' };
    const D = (st.data[t.id] = {});
    COLLECTIONS.forEach((c) => (D[c] = {}));
    const put = (c, o) => { const id = o.id || uid(); D[c][id] = { createdAt: nowIso(), updatedAt: nowIso(), ...o, id }; return id; };
    const ago = (n) => addDays(new Date(), -n).toISOString();
    const dayStr = (n) => addDays(new Date(), n).toISOString().slice(0, 10);

    const c1 = put('customers', { type: 'bireysel', name: 'Mehmet Yılmaz', phone: '0532 111 22 33', email: 'mehmet@example.com', city: 'Samsun', note: '' });
    const c2 = put('customers', { type: 'kurumsal', name: 'Karadeniz Lojistik Ltd.', phone: '0362 444 55 66', taxOffice: 'Atakum', taxNo: '9876543210', city: 'Samsun', note: 'Filo müşterisi, 30 gün vadeli' });
    const c3 = put('customers', { type: 'bireysel', name: 'Ayşe Demir', phone: '0544 777 88 99', city: 'Samsun' });
    const v1 = put('vehicles', { customerId: c1, plate: '55 ABC 123', make: 'Peugeot', model: '301', year: 2018, engine: '1.6 HDi', vin: 'VF3DD9HJ0JJ000001', km: 128400, color: 'Beyaz' });
    const v2 = put('vehicles', { customerId: c2, plate: '55 KL 4410', make: 'Fiat', model: 'Doblo', year: 2020, engine: '1.6 Multijet', vin: 'ZFA26300000000002', km: 210300, color: 'Beyaz' });
    const v3 = put('vehicles', { customerId: c3, plate: '55 AD 908', make: 'Renault', model: 'Clio', year: 2016, engine: '1.5 dCi', vin: 'VF15R0000000003', km: 96500, color: 'Kırmızı' });
    const v4 = put('vehicles', { customerId: c2, plate: '55 KL 4411', make: 'Peugeot', model: 'Partner', year: 2019, engine: '1.6 HDi', km: 185000 });

    const p1 = put('parts', { code: 'ER-YF-1601', name: 'Yağ Filtresi', brand: 'Eurorepar', oem: '1109.CK', unit: 'adet', buy: 120, sell: 210, vat: 20, stock: 14, minStock: 5, shelf: 'A-1',
      compat: [{ make: 'Peugeot', model: '', yearFrom: 2012, yearTo: 2022, engine: '1.6 HDi' }, { make: 'Citroen', model: '', yearFrom: 2012, yearTo: 2022, engine: '1.6 HDi' }] });
    const p2 = put('parts', { code: 'ER-HF-301', name: 'Hava Filtresi', brand: 'Eurorepar', oem: '1444.TT', unit: 'adet', buy: 180, sell: 320, vat: 20, stock: 3, minStock: 4, shelf: 'A-2',
      compat: [{ make: 'Peugeot', model: '301', yearFrom: 2012, yearTo: 2022, engine: '' }] });
    const p3 = put('parts', { code: 'ER-BK-221', name: 'Ön Fren Balatası', brand: 'Eurorepar', oem: '1617253880', unit: 'takım', buy: 650, sell: 1150, vat: 20, stock: 6, minStock: 2, shelf: 'B-4',
      compat: [{ make: 'Peugeot', model: '301', yearFrom: 2012, yearTo: 2022, engine: '' }, { make: 'Citroen', model: 'C-Elysee', yearFrom: 2012, yearTo: 2022, engine: '' }] });
    put('parts', { code: 'MT-5W30-4', name: 'Motor Yağı 5W-30 (4 L)', brand: 'Total', oem: '', unit: 'adet', buy: 900, sell: 1400, vat: 20, stock: 22, minStock: 6, shelf: 'C-1', compat: [] });
    put('parts', { code: 'ER-YF-RN15', name: 'Yağ Filtresi', brand: 'Eurorepar', oem: '152089599R', unit: 'adet', buy: 110, sell: 195, vat: 20, stock: 9, minStock: 4, shelf: 'A-1',
      compat: [{ make: 'Renault', model: '', yearFrom: 2010, yearTo: 2020, engine: '1.5 dCi' }, { make: 'Dacia', model: '', yearFrom: 2010, yearTo: 2020, engine: '1.5 dCi' }] });
    put('parts', { code: 'ER-DS-DB', name: 'Debriyaj Seti', brand: 'Eurorepar', oem: '55241791', unit: 'takım', buy: 3800, sell: 5600, vat: 20, stock: 1, minStock: 1, shelf: 'D-2',
      compat: [{ make: 'Fiat', model: 'Doblo', yearFrom: 2015, yearTo: 2023, engine: '1.6 Multijet' }] });

    const line = (type, name, qty, price, partId) => ({ type, name, qty, price, vat: 20, partId: partId || null });
    put('workorders', { id: 'wo1', no: 'IE-0001', customerId: c1, vehicleId: v1, km: 128400, complaint: 'Periyodik bakım, frenden ses geliyor', diagnosis: 'Ön balatalar bitmiş', status: 'teslim', technician: 'Ahmet Usta',
      lines: [line('parca', 'Yağ Filtresi', 1, 210, p1), line('parca', 'Ön Fren Balatası', 1, 1150, p3), line('iscilik', 'Periyodik bakım işçiliği', 1, 800)], stockApplied: true, invoiceId: 'inv1', createdAt: ago(6) });
    put('workorders', { no: 'IE-0002', customerId: c2, vehicleId: v2, km: 210300, complaint: 'Debriyaj kaçırıyor', diagnosis: '', status: 'parca', technician: 'Murat', lines: [line('iscilik', 'Debriyaj değişim işçiliği', 1, 2500)], createdAt: ago(2) });
    put('workorders', { no: 'IE-0003', customerId: c3, vehicleId: v3, km: 96500, complaint: 'Motor arıza lambası yanıyor', diagnosis: '', status: 'islemde', technician: 'Ahmet Usta', lines: [line('iscilik', 'Arıza tespit (diagnostik)', 1, 600)], createdAt: ago(0) });
    put('invoices', { id: 'inv1', no: 'FTR-2026-0001', kind: 'fatura', customerId: c1, vehicleId: v1, workOrderId: 'wo1', date: dayStr(-6),
      lines: [line('parca', 'Yağ Filtresi', 1, 210, p1), line('parca', 'Ön Fren Balatası', 1, 1150, p3), line('iscilik', 'Periyodik bakım işçiliği', 1, 800)], note: '', createdAt: ago(6) });
    put('payments', { invoiceId: 'inv1', customerId: c1, amount: 1500, method: 'kart', date: dayStr(-6), note: '' });
    put('appointments', { date: dayStr(0), time: '10:30', customerId: c2, vehicleId: v4, note: 'Periyodik bakım', status: 'bekliyor' });
    put('appointments', { date: dayStr(1), time: '09:00', customerId: c1, vehicleId: v1, note: 'Balata kontrolü', status: 'bekliyor' });
    t.counters = { workorder: 3, invoice: 1 };
    st.session = null;
  }

  /* -------------------------------------------------------------- FIREBASE */
  function FirebaseAPI() {
    const V = SP.config.firebaseVersion;
    const base = `https://www.gstatic.com/firebasejs/${V}/`;
    let F = {}; let app, auth, db, fns;
    const tid = () => SP.session.tenant.id;
    const col = (c) => F.collection(db, 'tenants', tid(), c);
    const conv = (d) => {
      const x = { id: d.id, ...d.data() };
      for (const k of Object.keys(x)) if (x[k] && typeof x[k].toDate === 'function') x[k] = x[k].toDate().toISOString();
      return x;
    };
    const call = async (name, data) => {
      try { const r = await F.httpsCallable(fns, name)(data); return r.data; }
      catch (e) { throw new Error(e.message || 'Sunucu hatası'); }
    };

    const api = {
      isDemo: false,
      async init() {
        const [a, au, fs, fu] = await Promise.all([
          import(base + 'firebase-app.js'), import(base + 'firebase-auth.js'),
          import(base + 'firebase-firestore.js'), import(base + 'firebase-functions.js')]);
        F = { ...a, ...au, ...fs, ...fu };
        app = F.initializeApp(SP.config.firebaseConfig);
        auth = F.getAuth(app); F.useDeviceLanguage(auth);
        db = F.getFirestore(app);
        fns = F.getFunctions(app, SP.config.functionsRegion);
      },
      onAuthChange(cb) { F.onAuthStateChanged(auth, (u) => cb(u ? { uid: u.uid, email: u.email, name: u.displayName } : null)); },
      currentUser() { const u = auth.currentUser; return u ? { uid: u.uid, email: u.email, name: u.displayName } : null; },
      async register({ name, email, password, company, phone }) {
        email = email.toLowerCase().trim();
        let cred;
        try { cred = await F.createUserWithEmailAndPassword(auth, email, password); } catch (e) { throw wrapErr(e); }
        await F.updateProfile(cred.user, { displayName: name });
        F.sendEmailVerification(cred.user).catch(() => {});
        const uidv = cred.user.uid;
        const invRef = F.doc(db, 'invites', email);
        const inv = await F.getDoc(invRef).catch(() => null);
        if (inv && inv.exists()) {
          await F.setDoc(F.doc(db, 'users', uidv), { tenantId: inv.data().tenantId, role: inv.data().role || 'staff', name, email, createdAt: F.serverTimestamp() });
          await F.deleteDoc(invRef).catch(() => {});
        } else {
          const tRef = F.doc(F.collection(db, 'tenants'));
          await F.setDoc(tRef, {
            name: company || 'Servisim', phone: phone || '', email, address: '', taxOffice: '', taxNo: '',
            ownerUid: uidv, plan: 'profesyonel', status: 'trial', createdAt: F.serverTimestamp(),
            trialEndsAt: F.Timestamp.fromDate(addDays(new Date(), SP.config.trialDays)),
          });
          await F.setDoc(F.doc(db, 'users', uidv), { tenantId: tRef.id, role: 'owner', name, email, createdAt: F.serverTimestamp() });
        }
        await cred.user.getIdToken(true);
      },
      async login(email, password) { try { await F.signInWithEmailAndPassword(auth, email.trim(), password); } catch (e) { throw wrapErr(e); } },
      async logout() { await F.signOut(auth); },
      async resetPassword(email) { try { await F.sendPasswordResetEmail(auth, email.trim()); } catch (e) { throw wrapErr(e); } },
      async loadSession(user) {
        const p = await F.getDoc(F.doc(db, 'users', user.uid));
        if (!p.exists() || !p.data().tenantId) return { profile: p.exists() ? p.data() : null, tenant: null };
        const t = await F.getDoc(F.doc(db, 'tenants', p.data().tenantId));
        return { profile: p.data(), tenant: t.exists() ? conv(t) : null };
      },
      async list(c) { try { const s = await F.getDocs(col(c)); return s.docs.map(conv); } catch (e) { throw wrapErr(e); } },
      async get(c, id) { const d = await F.getDoc(F.doc(col(c), id)); return d.exists() ? conv(d) : null; },
      async add(c, data) { try { const r = await F.addDoc(col(c), { ...data, createdAt: nowIso(), updatedAt: nowIso() }); return r.id; } catch (e) { throw wrapErr(e); } },
      async update(c, id, data) { try { await F.updateDoc(F.doc(col(c), id), { ...data, updatedAt: nowIso() }); } catch (e) { throw wrapErr(e); } },
      async remove(c, id) { try { await F.deleteDoc(F.doc(col(c), id)); } catch (e) { throw wrapErr(e); } },
      async nextNo(key) {
        const ref = F.doc(db, 'tenants', tid(), 'meta', 'counters');
        return F.runTransaction(db, async (tx) => {
          const s = await tx.get(ref);
          const n = ((s.exists() && s.data()[key]) || 0) + 1;
          tx.set(ref, { [key]: n }, { merge: true });
          return n;
        });
      },
      async updateTenant(data) {
        const allowed = ['name', 'phone', 'email', 'address', 'taxOffice', 'taxNo', 'iban', 'invoiceNote'];
        const clean = Object.fromEntries(Object.entries(data).filter(([k]) => allowed.includes(k)));
        try { await F.updateDoc(F.doc(db, 'tenants', tid()), clean); } catch (e) { throw wrapErr(e); }
        Object.assign(SP.session.tenant, clean);
      },
      async members() {
        const us = await F.getDocs(F.query(F.collection(db, 'users'), F.where('tenantId', '==', tid())));
        const iv = await F.getDocs(F.query(F.collection(db, 'invites'), F.where('tenantId', '==', tid())));
        return { users: us.docs.map((d) => ({ uid: d.id, ...d.data() })), invites: iv.docs.map((d) => ({ email: d.id, ...d.data() })) };
      },
      async invite(email, role) { await F.setDoc(F.doc(db, 'invites', email.toLowerCase().trim()), { tenantId: tid(), role, createdAt: nowIso() }); },
      async revokeInvite(email) { await F.deleteDoc(F.doc(db, 'invites', email)); },
      async removeMember(memberUid) { await F.updateDoc(F.doc(db, 'users', memberUid), { tenantId: null }); },
      // iyzico abonelik — Cloud Functions üzerinden
      async startCheckout(planId, buyer) { return call('startSubscription', { planId, buyer }); },
      async changePlan(planId) { await call('changePlan', { planId }); },
      async cancelSubscription() { await call('cancelSubscription', {}); },
      async adminTenants() { const s = await F.getDocs(F.collection(db, 'tenants')); return s.docs.map(conv); },
      async refreshTenant() { const t = await F.getDoc(F.doc(db, 'tenants', tid())); SP.session.tenant = conv(t); },
    };
    return api;
  }

  const hasFirebase = SP.config.firebaseConfig && SP.config.firebaseConfig.apiKey && !SP.forceDemo;
  SP.api = hasFirebase ? FirebaseAPI() : DemoAPI();
})();
