/* Fatura, teklif, tahsilat ve kasa raporu */
(function () {
  const SP = window.SP;
  const { h, toast, money, num, date, table, badge, pageHead, formModal, confirmBox, searchBox, norm } = SP.ui;
  const C = SP.core;
  const METHOD = Object.fromEntries(C.PAY_METHODS);

  function addPayment({ invoice, customerId, due }, after) {
    if (!C.guardWrite()) return;
    formModal(invoice ? `Tahsilat — ${invoice.no}` : 'Cari tahsilat', [
      ...(invoice ? [] : [{ name: 'customerId', label: 'Müşteri', type: 'select', required: true, span: 2, options: () => [['', '— Müşteri seçin —'], ...(SP._customers || []).map((c) => [c.id, c.name])] }]),
      { name: 'amount', label: 'Tutar (₺)', type: 'number', step: '0.01', min: 0.01, required: true, default: due ? due.toFixed(2) : '' },
      { name: 'method', label: 'Ödeme şekli', type: 'select', options: C.PAY_METHODS },
      { name: 'date', label: 'Tarih', type: 'date', default: SP.ui.today() },
      { name: 'note', label: 'Açıklama' },
    ], { customerId: customerId || '' }, async (d) => {
      if (!(d.amount > 0)) throw new Error('Tutar girin');
      await C.add('payments', { invoiceId: invoice ? invoice.id : null, customerId: invoice ? invoice.customerId : d.customerId, amount: d.amount, method: d.method, date: d.date, note: d.note });
      toast('Tahsilat kaydedildi'); after();
    });
  }

  SP.pages.faturalar = async (view) => {
    const [inv, pay, cs, vs] = await Promise.all([C.all('invoices'), C.all('payments'), C.all('customers'), C.all('vehicles')]);
    SP._customers = cs;
    const cMap = C.byId(cs), vMap = C.byId(vs);
    let tab = 'fatura', q = '', month = new Date().toISOString().slice(0, 7);
    const box = h('div'), tabs = h('div', { class: 'tabs' }), extra = h('div', { class: 'row gap' });
    const reload = () => SP.refresh();
    const receivable = cs.reduce((s, c) => s + Math.max(0, C.customerBalance(c.id, inv, pay)), 0);
    const draw = () => {
      tabs.replaceChildren(...[['fatura', 'Faturalar'], ['acik', 'Ödenmemiş'], ['teklif', 'Teklifler'], ['kasa', 'Kasa / tahsilatlar']].filter(([k]) => k !== 'kasa' || SP.can('cash')).map(([k, l]) => h('button', { class: 'tab' + (tab === k ? ' on' : ''), onclick: () => { tab = k; draw(); } }, l)));
      extra.replaceChildren(tab === 'kasa' || tab === 'fatura' ? h('input', { type: 'month', value: month, class: 'month', 'aria-label': 'Ay', onchange: (e) => { month = e.target.value; draw(); } }) : '');
      if (tab === 'kasa') return drawKasa();
      let rows = inv.filter((i) => (tab === 'teklif' ? i.kind === 'teklif' : i.kind !== 'teklif'));
      if (tab === 'acik') rows = rows.filter((i) => C.invoiceStatus(i, pay).due > 0);
      if (tab === 'fatura' && month) rows = rows.filter((i) => String(i.date).slice(0, 7) === month);
      if (q) rows = rows.filter((i) => norm([i.no, (cMap[i.customerId] || {}).name, (vMap[i.vehicleId] || {}).plate].join(' ')).includes(q));
      rows.sort((a, b) => String(b.date + b.no).localeCompare(String(a.date + a.no)));
      const sum = rows.reduce((s, i) => s + C.totals(i.lines).total, 0);
      box.replaceChildren(h('p', { class: 'muted small' }, `${rows.length} belge · toplam ${money(sum)}`), table(rows, [
        { label: 'No', get: (i) => h('b', null, i.no) }, { label: 'Tarih', get: (i) => date(i.date) },
        { label: 'Müşteri', get: (i) => (cMap[i.customerId] || {}).name || '—' },
        { label: 'Araç', get: (i) => (vMap[i.vehicleId] ? h('span', { class: 'plate' }, vMap[i.vehicleId].plate) : '—') },
        { label: 'Durum', get: (i) => { const s = C.invoiceStatus(i, pay); return badge(s.label, s.kind); } },
        { label: 'Kalan', class: 'right', get: (i) => { const s = C.invoiceStatus(i, pay); return s.due > 0 ? h('b', { class: 'neg' }, money(s.due)) : '—'; } },
        { label: 'Tutar', class: 'right', get: (i) => money(C.totals(i.lines).total) },
      ], { empty: 'Belge yok. Faturalar iş emri ekranından “Fatura kes” ile oluşturulur.', onRow: (i) => SP.go('fatura--' + i.id) }));
    };
    const drawKasa = () => {
      const rows = pay.filter((p) => String(p.date).slice(0, 7) === month).sort((a, b) => String(b.date).localeCompare(String(a.date)));
      const by = {}; rows.forEach((p) => (by[p.method] = (by[p.method] || 0) + Number(p.amount)));
      box.replaceChildren(
        h('div', { class: 'kpis' }, SP.kpi('Ay toplamı', money(rows.reduce((s, p) => s + Number(p.amount), 0))), ...C.PAY_METHODS.map(([k, l]) => SP.kpi(l, money(by[k] || 0)))),
        table(rows, [
          { label: 'Tarih', get: (p) => date(p.date) }, { label: 'Müşteri', get: (p) => (cMap[p.customerId] || {}).name || '—' },
          { label: 'Belge', get: (p) => { const i = inv.find((x) => x.id === p.invoiceId); return i ? h('a', { href: '#fatura--' + i.id }, i.no) : 'Cari'; } },
          { label: 'Şekil', get: (p) => METHOD[p.method] || p.method }, { label: 'Açıklama', get: (p) => p.note || '—' },
          { label: 'Tutar', class: 'right', get: (p) => h('b', null, money(p.amount)) },
          { label: '', class: 'right', get: (p) => h('button', { class: 'icon-btn', 'aria-label': 'Tahsilatı sil', onclick: async () => { if (await confirmBox(`${money(p.amount)} tutarındaki tahsilat silinsin mi?`)) { await C.remove('payments', p.id); reload(); } } }, '✕') },
        ], { empty: 'Bu ay tahsilat yok.' }));
    };
    view.append(pageHead('Fatura & tahsilat', `Toplam alacak: ${money(receivable)}`, h('button', { class: 'btn primary', onclick: () => addPayment({}, reload) }, '+ Cari tahsilat')),
      h('div', { class: 'toolbar' }, tabs, extra, searchBox('No, müşteri, plaka…', (v) => { q = v; draw(); })), box);
    draw();
  };

  SP.pages.fatura = async (view, r) => {
    const [inv, pay, cs, vs] = await Promise.all([C.all('invoices', true), C.all('payments', true), C.all('customers'), C.all('vehicles')]);
    const i = inv.find((x) => x.id === r.id);
    if (!i) { view.append(h('div', { class: 'empty' }, 'Belge bulunamadı.')); return; }
    const c = C.byId(cs)[i.customerId] || {}, v = C.byId(vs)[i.vehicleId] || {};
    const s = C.invoiceStatus(i, pay), myPay = pay.filter((p) => p.invoiceId === i.id);
    const reload = () => SP.refresh();
    const doc = invoiceDoc(i, c, v, s);
    const msg = `Sayın ${c.name}, ${v.plate || ''} aracınızın servis ${i.kind === 'teklif' ? 'teklifi' : 'faturası'} ${i.no}: ${money(s.total)}.${s.due > 0 && i.kind !== 'teklif' ? ' Kalan: ' + money(s.due) + '.' : ''} ${SP.session.tenant.name}${SP.session.tenant.iban ? ' · IBAN: ' + SP.session.tenant.iban : ''}`;
    view.append(
      pageHead(`${i.kind === 'teklif' ? 'Teklif' : 'Fatura'} ${i.no}`, `${c.name || ''} · ${date(i.date)}`,
        h('button', { class: 'btn ghost', onclick: () => SP.printDoc(invoiceDoc(i, c, v, s)) }, 'Yazdır / PDF'),
        c.phone ? h('a', { class: 'btn ghost', href: SP.waLink(c.phone, msg), target: '_blank', rel: 'noopener' }, 'WhatsApp’tan gönder') : null,
        i.kind === 'teklif' ? h('button', { class: 'btn primary', onclick: async () => {
          const n = await SP.api.nextNo('invoice');
          const no = 'FTR-' + new Date().getFullYear() + '-' + String(n).padStart(4, '0');
          await C.update('invoices', i.id, { kind: 'fatura', no, quoteNo: i.no, date: SP.ui.today() });
          if (i.workOrderId) await C.update('workorders', i.workOrderId, { invoiceId: i.id });
          toast('Teklif faturaya dönüştürüldü: ' + no); reload();
        } }, 'Faturaya dönüştür') : (s.due > 0 ? h('button', { class: 'btn primary', onclick: () => addPayment({ invoice: i, due: s.due }, reload) }, '+ Tahsilat') : null)),
      i.kind !== 'teklif' ? h('div', { class: 'kpis' }, SP.kpi('Toplam', money(s.total)), SP.kpi('Ödenen', money(s.paid)), SP.kpi('Kalan', money(s.due), null, s.due > 0 ? 'neg' : ''), SP.kpi('Durum', badge(s.label, s.kind))) : null,
      h('div', { class: 'card doc-preview' }, doc),
      i.kind !== 'teklif' ? [h('h2', { class: 'sec' }, 'Tahsilatlar'), table(myPay, [
        { label: 'Tarih', get: (p) => date(p.date) }, { label: 'Şekil', get: (p) => METHOD[p.method] || p.method },
        { label: 'Açıklama', get: (p) => p.note || '—' }, { label: 'Tutar', class: 'right', get: (p) => money(p.amount) },
        { label: '', class: 'right', get: (p) => h('button', { class: 'icon-btn', 'aria-label': 'Sil', onclick: async () => { if (await confirmBox('Tahsilat silinsin mi?')) { await C.remove('payments', p.id); reload(); } } }, '✕') }],
      { empty: 'Henüz tahsilat yok.' })] : null,
      h('div', { class: 'row between danger-zone' }, h('span', { class: 'muted small' }, i.workOrderId ? h('a', { href: '#is-emri--' + i.workOrderId }, 'Bağlı iş emrine git') : ''),
        h('button', { class: 'btn sm ghost', onclick: async () => {
          if (myPay.length) return toast('Tahsilatı olan belge silinemez. Önce tahsilatları silin.', 'err');
          if (!(await confirmBox(`${i.no} silinsin mi?`))) return;
          await C.remove('invoices', i.id);
          if (i.workOrderId && i.kind !== 'teklif') await C.update('workorders', i.workOrderId, { invoiceId: null });
          SP.go('faturalar');
        } }, 'Belgeyi sil')));
  };

  function invoiceDoc(i, c, v, s) {
    const t = SP.session.tenant, tot = C.totals(i.lines);
    const byVat = {};
    i.lines.forEach((l) => { const n = (l.qty || 0) * (l.price || 0) * (1 - (l.discount || 0) / 100); const r = Number(l.vat ?? 20); byVat[r] = (byVat[r] || 0) + n * r / 100; });
    return h('div', { class: 'doc' },
      h('div', { class: 'doc-head' },
        h('div', null, t.logo ? h('img', { class: 'doc-logo', src: t.logo, alt: '' }) : null, h('h2', null, t.name), h('div', null, t.address), h('div', null, [t.phone, t.email].filter(Boolean).join(' · ')), t.taxNo ? h('div', null, `VD: ${t.taxOffice || ''} · VKN: ${t.taxNo}`) : null),
        h('div', { class: 'right' }, h('h1', null, i.kind === 'teklif' ? 'FİYAT TEKLİFİ' : 'SERVİS FATURASI'), h('div', null, 'No: ', h('b', null, i.no)), h('div', null, 'Tarih: ' + date(i.date)), i.kind === 'teklif' ? h('div', null, 'Geçerlilik: 15 gün') : null)),
      h('div', { class: 'doc-2col' },
        h('div', null, h('h4', null, 'Sayın'), h('div', null, h('b', null, c.name)), h('div', null, [c.address, c.city].filter(Boolean).join(', ')), c.taxNo ? h('div', null, `VD: ${c.taxOffice || ''} · No: ${c.taxNo}`) : null, h('div', null, c.phone)),
        h('div', null, h('h4', null, 'Araç'), h('div', null, h('b', null, v.plate || '—'), ' · ', [v.make, v.model, v.year].filter(Boolean).join(' ')), h('div', null, 'Şasi: ' + (v.vin || '—')), h('div', null, 'Km: ' + (i.km ? num(i.km) : v.km ? num(v.km) : '—')))),
      h('table', null, h('thead', null, h('tr', null, ['Açıklama', 'Miktar', 'Birim fiyat', 'İsk.', 'KDV', 'Tutar'].map((x, k) => h('th', { class: k ? 'right' : null }, x)))),
        h('tbody', null, i.lines.map((l) => h('tr', null, h('td', null, l.name), h('td', { class: 'right' }, num(l.qty)), h('td', { class: 'right' }, money(l.price)), h('td', { class: 'right' }, l.discount ? '%' + l.discount : '—'), h('td', { class: 'right' }, '%' + (l.vat ?? 20)), h('td', { class: 'right' }, money((l.qty || 0) * (l.price || 0) * (1 - (l.discount || 0) / 100))))))),
      h('div', { class: 'doc-sum' },
        h('div', null, h('span', null, 'Ara toplam'), h('span', null, money(tot.net))),
        Object.entries(byVat).map(([r, x]) => h('div', null, h('span', null, `KDV (%${r})`), h('span', null, money(x)))),
        h('div', { class: 'grand' }, h('span', null, 'Genel toplam'), h('b', null, money(tot.total))),
        i.kind !== 'teklif' && s.paid > 0 ? h('div', null, h('span', null, 'Ödenen'), h('span', null, money(s.paid))) : null,
        i.kind !== 'teklif' && s.due > 0 ? h('div', null, h('span', null, 'Kalan'), h('b', null, money(s.due))) : null),
      t.iban ? h('p', { class: 'small' }, 'IBAN: ' + t.iban) : null,
      t.invoiceNote ? h('p', { class: 'small' }, t.invoiceNote) : null,
      h('p', { class: 'small muted' }, 'Bu belge bilgi amaçlıdır; resmi e-Fatura / e-Arşiv yerine geçmez.'));
  }
})();
