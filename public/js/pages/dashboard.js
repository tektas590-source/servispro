/* Gösterge paneli */
(function () {
  const SP = window.SP;
  const { h, money, table, badge, pageHead, date } = SP.ui;
  const C = SP.core;

  SP.pages.panel = async (view) => {
    const [wos, as, parts, inv, pay, cs, vs] = await Promise.all(['workorders', 'appointments', 'parts', 'invoices', 'payments', 'customers', 'vehicles'].map((c) => C.all(c)));
    const cMap = C.byId(cs), vMap = C.byId(vs);
    const today = SP.ui.today(), ym = today.slice(0, 7);
    const open = wos.filter((w) => ['acik', 'islemde', 'parca', 'hazir'].includes(w.status));
    const todayA = as.filter((a) => a.date === today && a.status !== 'iptal').sort((a, b) => a.time.localeCompare(b.time));
    const monthInv = inv.filter((i) => i.kind !== 'teklif' && String(i.date).slice(0, 7) === ym);
    const ciro = monthInv.reduce((s, i) => s + C.totals(i.lines).total, 0);
    const kasa = pay.filter((p) => String(p.date).slice(0, 7) === ym).reduce((s, p) => s + Number(p.amount), 0);
    const receivable = cs.reduce((s, c) => s + Math.max(0, C.customerBalance(c.id, inv, pay)), 0);
    const crit = parts.filter((p) => (Number(p.stock) || 0) <= (Number(p.minStock) || 0));
    const max = C.limits().workOrdersPerMonth;
    const monthWo = wos.filter((w) => String(w.createdAt).slice(0, 7) === ym).length;
    const hour = new Date().getHours();
    const hi = hour < 12 ? 'Günaydın' : hour < 18 ? 'İyi günler' : 'İyi akşamlar';
    const first = (SP.session.user.name || '').split(' ')[0];

    view.append(
      pageHead(`${hi}${first ? ', ' + first : ''}`, new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
        h('button', { class: 'btn ghost', onclick: () => SP.editAppt(null, () => SP.refresh()) }, '+ Randevu'),
        h('button', { class: 'btn primary', onclick: () => SP.newWorkOrder() }, '+ Araç kabul')),
      h('div', { class: 'kpis' },
        h('a', { href: '#is-emirleri', class: 'kpi link' }, h('small', null, 'Serviste'), h('b', null, open.length), h('span', { class: 'muted small' }, `${open.filter((w) => w.status === 'hazir').length} araç teslime hazır`)),
        h('a', { href: '#randevular', class: 'kpi link' }, h('small', null, 'Bugünkü randevu'), h('b', null, todayA.length)),
        h('a', { href: '#faturalar', class: 'kpi link' }, h('small', null, 'Bu ay fatura'), h('b', null, money(ciro)), h('span', { class: 'muted small' }, `Tahsil edilen ${money(kasa)}`)),
        h('a', { href: '#faturalar', class: 'kpi link' + (receivable > 0 ? ' neg' : '') }, h('small', null, 'Toplam alacak'), h('b', null, money(receivable)))),
      (() => { const td = SP.ui.today(), lim = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10); const n = vs.filter((v) => v.nextServiceDate && v.nextServiceDate <= lim).length; const late = vs.filter((v) => v.nextServiceDate && v.nextServiceDate < td).length;
        return n ? h('a', { href: '#hatirlatma', class: 'banner info dash-remind' }, h('span', null, `${n} aracın bakımı 30 gün içinde geliyor` + (late ? ` (${late} tanesi gecikmiş)` : '') + '. Müşterilere hatırlatın, servisinize geri gelsinler.'), h('b', null, 'Listeyi aç →')) : null; })(),
      max != null ? h('div', { class: 'usage' }, h('span', null, `Bu ay ${monthWo} / ${max} iş emri`), h('div', { class: 'bar' }, h('i', { style: { width: Math.min(100, (monthWo / max) * 100) + '%' } }))) : null,
      h('div', { class: 'grid2' },
        h('section', null, h('h2', { class: 'sec' }, 'Serviste olan araçlar'), table(open.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt))).slice(0, 8), [
          { label: 'Araç', get: (w) => (vMap[w.vehicleId] ? h('span', { class: 'plate' }, vMap[w.vehicleId].plate) : '—') },
          { label: 'Müşteri', get: (w) => (cMap[w.customerId] || {}).name || '—' },
          { label: 'Durum', get: (w) => badge(C.WO_STATUS[w.status].label, C.WO_STATUS[w.status].kind) },
          { label: 'Giriş', get: (w) => date(w.createdAt) },
        ], { empty: 'Serviste araç yok.', onRow: (w) => SP.go('is-emri--' + w.id) })),
        h('section', null, h('h2', { class: 'sec' }, 'Bugünkü randevular'), table(todayA, [
          { label: 'Saat', get: (a) => h('b', null, a.time) },
          { label: 'Araç', get: (a) => (vMap[a.vehicleId] ? h('span', { class: 'plate' }, vMap[a.vehicleId].plate) : '—') },
          { label: 'Müşteri', get: (a) => (cMap[a.customerId] || {}).name || '—' },
          { label: 'İşlem', get: (a) => a.note || '—' },
        ], { empty: 'Bugün randevu yok.', onRow: () => SP.go('randevular') }))),
      h('section', null, h('h2', { class: 'sec' }, `Kritik stok (${crit.length})`), table(crit.slice(0, 10), [
        { label: 'Kod', get: (p) => h('b', null, p.code) }, { label: 'Parça', get: (p) => p.name + (p.brand ? ' · ' + p.brand : '') },
        { label: 'Stok', class: 'right', get: SP.stockBadge }, { label: 'Kritik seviye', class: 'right', get: (p) => p.minStock || 0 },
      ], { empty: 'Kritik seviyede parça yok.', onRow: () => SP.go('stok') })));
  };
})();
