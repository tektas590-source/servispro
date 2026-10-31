/* İş kuralları: abonelik durumu, paket limitleri, tutar hesapları, parça-araç uyumluluğu */
(function () {
  const SP = window.SP;
  const { norm, toDate } = SP.ui;

  /* ---------- Abonelik ---------- */
  function subState(t) {
    if (!t) return { active: false, label: 'Hesap yok', kind: 'err' };
    const plan = SP.PLANS[t.plan] || SP.PLANS.baslangic;
    const now = new Date();
    if (t.status === 'trial') {
      const end = toDate(t.trialEndsAt);
      const days = Math.ceil((end - now) / 86400000);
      if (days > 0) return { active: true, trial: true, daysLeft: days, plan, label: `Deneme · ${days} gün kaldı`, kind: days <= 3 ? 'warn' : 'info' };
      return { active: false, plan, label: 'Deneme süresi bitti', kind: 'err' };
    }
    if (t.status === 'active') return { active: true, plan, label: plan.name + ' · Aktif', kind: 'ok' };
    if (t.status === 'past_due') {
      // ödeme alınamadı: 3 gün tolerans
      const end = toDate(t.currentPeriodEnd);
      const grace = end ? (end - now) / 86400000 + 3 : 0;
      return { active: grace > 0, plan, label: 'Ödeme alınamadı', kind: 'err', pastDue: true };
    }
    if (t.status === 'canceled') {
      const end = toDate(t.currentPeriodEnd);
      if (end && end > now) return { active: true, plan, label: `İptal edildi · ${SP.ui.date(end)} tarihine kadar açık`, kind: 'warn', canceled: true };
      return { active: false, plan, label: 'Abonelik iptal edildi', kind: 'err', canceled: true };
    }
    return { active: false, plan, label: 'Abonelik yok', kind: 'err' };
  }
  const limits = () => subState(SP.session.tenant).plan.limits;
  const canWrite = () => subState(SP.session.tenant).active;
  function guardWrite() {
    if (!canWrite()) { SP.ui.toast('Aboneliğiniz aktif değil. Kayıt eklemek için paket seçin.', 'err'); location.hash = '#abonelik'; return false; }
    return true;
  }
  function limitError(kind, max) {
    const nm = { workOrdersPerMonth: `aylık ${max} iş emri`, parts: `${max} stok kartı`, users: `${max} kullanıcı`, compat: 'parça–araç uyumluluğu' }[kind];
    return new Error(`Paketinizin sınırına ulaştınız (${nm}). Daha fazlası için paketinizi yükseltin.`);
  }

  /* ---------- Önbellek: sık kullanılan listeler ---------- */
  const cache = {};
  async function all(c, force) {
    if (force || !cache[c]) cache[c] = await SP.api.list(c);
    return cache[c];
  }
  function invalidate(...cs) { cs.forEach((c) => delete cache[c]); }
  function clearCache() { Object.keys(cache).forEach((k) => delete cache[k]); }
  async function add(c, data) { if (!guardWrite()) throw new Error('Abonelik aktif değil'); const id = await SP.api.add(c, data); invalidate(c); return id; }
  async function update(c, id, data) { if (!guardWrite()) throw new Error('Abonelik aktif değil'); await SP.api.update(c, id, data); invalidate(c); }
  async function remove(c, id) { if (!guardWrite()) throw new Error('Abonelik aktif değil'); await SP.api.remove(c, id); invalidate(c); }
  const byId = (arr) => Object.fromEntries(arr.map((x) => [x.id, x]));

  /* ---------- Tutarlar ---------- */
  function totals(lines) {
    let net = 0, vat = 0, parts = 0, labor = 0;
    for (const l of lines || []) {
      const n = (Number(l.qty) || 0) * (Number(l.price) || 0) * (1 - (Number(l.discount) || 0) / 100);
      net += n; vat += n * (Number(l.vat ?? SP.VAT_DEFAULT) || 0) / 100;
      if (l.type === 'parca') parts += n; else labor += n;
    }
    const r = (x) => Math.round(x * 100) / 100;
    return { net: r(net), vat: r(vat), total: r(net + vat), parts: r(parts), labor: r(labor) };
  }
  function invoicePaid(inv, payments) { return payments.filter((p) => p.invoiceId === inv.id).reduce((s, p) => s + (Number(p.amount) || 0), 0); }
  function invoiceStatus(inv, payments) {
    const total = totals(inv.lines).total, paid = invoicePaid(inv, payments);
    if (inv.kind === 'teklif') return { key: 'teklif', label: 'Teklif', kind: 'info', total, paid, due: 0 };
    if (paid >= total - 0.009) return { key: 'odendi', label: 'Ödendi', kind: 'ok', total, paid, due: 0 };
    if (paid > 0) return { key: 'kismi', label: 'Kısmi ödendi', kind: 'warn', total, paid, due: total - paid };
    return { key: 'odenmedi', label: 'Ödenmedi', kind: 'err', total, paid, due: total };
  }
  function customerBalance(customerId, invoices, payments) {
    const debt = invoices.filter((i) => i.customerId === customerId && i.kind !== 'teklif').reduce((s, i) => s + totals(i.lines).total, 0);
    const paid = payments.filter((p) => p.customerId === customerId).reduce((s, p) => s + (Number(p.amount) || 0), 0);
    return Math.round((debt - paid) * 100) / 100;
  }

  /* ---------- Parça – araç uyumluluğu ----------
   * Kural: {make, model?, yearFrom?, yearTo?, engine?} — boş alan "hepsi" demektir.
   * Motor eşleşmesi kısmi (ör. "1.6 HDi" kuralı "1.6 HDi 92 BG" ile eşleşir).
   */
  function ruleMatches(rule, v) {
    if (!rule || !v) return false;
    if (rule.make && norm(rule.make) !== norm(v.make)) return false;
    if (rule.model && norm(rule.model) !== norm(v.model)) return false;
    const y = Number(v.year);
    if (rule.yearFrom && y && y < Number(rule.yearFrom)) return false;
    if (rule.yearTo && y && y > Number(rule.yearTo)) return false;
    if (rule.engine) { const a = norm(rule.engine), b = norm(v.engine); if (!b || !(b.includes(a) || a.includes(b))) return false; }
    return true;
  }
  const partFits = (part, v) => (part.compat || []).some((r) => ruleMatches(r, v));
  const compatText = (r) => [r.make, r.model || 'tüm modeller', (r.yearFrom || r.yearTo) ? `${r.yearFrom || '…'}–${r.yearTo || '…'}` : '', r.engine].filter(Boolean).join(' · ');

  /* ---------- Sabitler ---------- */
  const WO_STATUS = {
    acik: { label: 'Kabul edildi', kind: 'info' },
    islemde: { label: 'İşlemde', kind: 'warn' },
    parca: { label: 'Parça bekliyor', kind: 'warn' },
    hazir: { label: 'Hazır', kind: 'ok' },
    teslim: { label: 'Teslim edildi', kind: '' },
    iptal: { label: 'İptal', kind: 'err' },
  };
  const APPT_STATUS = { bekliyor: { label: 'Bekliyor', kind: 'info' }, geldi: { label: 'Geldi', kind: 'ok' }, gelmedi: { label: 'Gelmedi', kind: 'err' }, iptal: { label: 'İptal', kind: '' } };
  const PAY_METHODS = [['nakit', 'Nakit'], ['kart', 'Kredi kartı'], ['havale', 'Havale / EFT'], ['cek', 'Çek / Senet']];
  const MAKES = ['Peugeot', 'Citroen', 'DS', 'Opel', 'Fiat', 'Renault', 'Dacia', 'Volkswagen', 'Audi', 'Skoda', 'Seat', 'Ford', 'Toyota', 'Hyundai', 'Kia', 'Honda', 'Nissan', 'BMW', 'Mercedes-Benz', 'Volvo', 'Chery', 'Togg'];

  SP.core = { subState, limits, canWrite, guardWrite, limitError, all, invalidate, clearCache, add, update, remove, byId, totals, invoicePaid, invoiceStatus, customerBalance, ruleMatches, partFits, compatText, WO_STATUS, APPT_STATUS, PAY_METHODS, MAKES };
})();
