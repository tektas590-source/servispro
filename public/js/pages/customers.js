/* Müşteri & araç kayıtları */
(function () {
  const SP = window.SP;
  const { h, toast, money, num, date, table, badge, pageHead, formModal, confirmBox, searchBox, norm, plate } = SP.ui;
  const C = SP.core;

  const customerFields = [
    { name: 'type', label: 'Tür', type: 'select', options: [['bireysel', 'Bireysel'], ['kurumsal', 'Kurumsal']] },
    { name: 'name', label: 'Ad soyad / Firma ünvanı', required: true },
    { name: 'phone', label: 'Telefon', type: 'tel', required: true }, { name: 'email', label: 'E-posta', type: 'email' },
    { name: 'taxOffice', label: 'Vergi dairesi' }, { name: 'taxNo', label: 'Vergi / TC no' },
    { name: 'city', label: 'İl / ilçe' }, { name: 'address', label: 'Adres' },
    { name: 'note', label: 'Not', type: 'textarea', span: 2, rows: 2 },
  ];
  const vehicleFields = () => [
    { name: 'plate', label: 'Plaka', required: true, transform: plate, placeholder: '55 ABC 123' },
    { name: 'make', label: 'Marka', required: true, list: 'makes' },
    { name: 'model', label: 'Model', required: true, placeholder: '301, Clio, Egea…' },
    { name: 'year', label: 'Model yılı', type: 'number', min: 1970 },
    { name: 'engine', label: 'Motor', placeholder: '1.6 HDi, 1.5 dCi…' },
    { name: 'fuel', label: 'Yakıt', type: 'select', options: [['', '—'], ['dizel', 'Dizel'], ['benzin', 'Benzin'], ['lpg', 'Benzin + LPG'], ['hibrit', 'Hibrit'], ['elektrik', 'Elektrik']] },
    { name: 'vin', label: 'Şasi (VIN)', transform: (v) => v.toUpperCase() },
    { name: 'km', label: 'Kilometre', type: 'number', min: 0 },
    { name: 'color', label: 'Renk' },
  ];
  const makesList = () => h('datalist', { id: 'makes' }, C.MAKES.map((m) => h('option', { value: m })));

  function editCustomer(c, after) {
    if (!c && !C.guardWrite()) return;
    formModal(c ? 'Müşteriyi düzenle' : 'Yeni müşteri', customerFields, c || { type: 'bireysel' }, async (d) => {
      if (c) await C.update('customers', c.id, d); else { const id = await C.add('customers', d); d.id = id; }
      toast('Müşteri kaydedildi'); after && after(d);
    }, { wide: true });
  }
  function editVehicle(v, customerId, after) {
    if (!v && !C.guardWrite()) return;
    formModal(v ? 'Aracı düzenle' : 'Yeni araç', vehicleFields(), v || {}, async (d) => {
      const all = await C.all('vehicles');
      if (all.some((x) => plate(x.plate) === d.plate && (!v || x.id !== v.id))) throw new Error('Bu plaka zaten kayıtlı.');
      if (v) await C.update('vehicles', v.id, d); else { d.customerId = customerId; d.id = await C.add('vehicles', d); }
      toast('Araç kaydedildi'); after && after(d);
    }, { wide: true, extra: makesList() });
  }
  SP.editCustomer = editCustomer; SP.editVehicle = editVehicle;

  /* Liste */
  SP.pages.musteriler = async (view) => {
    const [cs, vs, inv, pay] = await Promise.all([C.all('customers'), C.all('vehicles'), C.all('invoices'), C.all('payments')]);
    const vByC = {};
    vs.forEach((v) => (vByC[v.customerId] = vByC[v.customerId] || []).push(v));
    let q = '';
    const box = h('div');
    const draw = () => {
      const rows = cs.filter((c) => !q || norm([c.name, c.phone, c.taxNo, ...(vByC[c.id] || []).map((v) => v.plate + ' ' + v.make + ' ' + v.model)].join(' ')).includes(q) || norm((vByC[c.id] || []).map((v) => v.plate.replace(/\s/g, '')).join(' ')).includes(q.replace(/\s/g, '')))
        .sort((a, b) => a.name.localeCompare(b.name, 'tr'));
      box.replaceChildren(table(rows, [
        { label: 'Müşteri', get: (c) => h('div', null, h('b', null, c.name), c.type === 'kurumsal' ? badge('Kurumsal', 'info') : null) },
        { label: 'Telefon', get: (c) => c.phone ? h('a', { href: 'tel:' + c.phone.replace(/\s/g, '') }, c.phone) : '—' },
        { label: 'Araçlar', get: (c) => (vByC[c.id] || []).map((v) => h('span', { class: 'plate' }, v.plate)) },
        { label: 'Bakiye', class: 'right', get: (c) => { const b = C.customerBalance(c.id, inv, pay); return b > 0 ? h('b', { class: 'neg' }, money(b)) : money(b); } },
      ], { empty: q ? 'Aramanızla eşleşen müşteri yok' : 'Henüz müşteri yok — ilk müşterinizi ekleyin.', onRow: (c) => SP.go('musteri--' + c.id) }));
    };
    view.append(pageHead('Müşteri & araç', `${cs.length} müşteri · ${vs.length} araç`,
      h('button', { class: 'btn primary', onclick: () => editCustomer(null, (d) => SP.go('musteri--' + d.id)) }, '+ Yeni müşteri')),
      h('div', { class: 'toolbar' }, searchBox('Ad, telefon veya plaka ile ara…', (v) => { q = v; draw(); })), box);
    draw();
  };

  /* Detay */
  SP.pages.musteri = async (view, r) => {
    const [cs, vs, wos, inv, pay, parts] = await Promise.all([C.all('customers'), C.all('vehicles'), C.all('workorders'), C.all('invoices'), C.all('payments'), C.all('parts')]);
    const c = cs.find((x) => x.id === r.id);
    if (!c) { view.append(h('div', { class: 'empty' }, 'Müşteri bulunamadı.')); return; }
    const myV = vs.filter((v) => v.customerId === c.id);
    const myWo = wos.filter((w) => w.customerId === c.id).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    const myInv = inv.filter((i) => i.customerId === c.id);
    const bal = C.customerBalance(c.id, inv, pay);
    const vMap = C.byId(vs);
    const refresh = () => SP.refresh();

    view.append(
      pageHead(c.name, [c.type === 'kurumsal' ? 'Kurumsal müşteri' : 'Bireysel müşteri', c.phone].filter(Boolean).join(' · '),
        h('button', { class: 'btn ghost', onclick: () => editCustomer(c, refresh) }, 'Düzenle'),
        h('button', { class: 'btn ghost', onclick: async () => {
          if (myV.length || myInv.length) return toast('Aracı veya faturası olan müşteri silinemez.', 'err');
          if (await confirmBox(`${c.name} silinsin mi?`)) { await C.remove('customers', c.id); SP.go('musteriler'); }
        } }, 'Sil'),
        h('button', { class: 'btn primary', onclick: () => SP.newWorkOrder({ customerId: c.id, vehicleId: myV[0] && myV[0].id }) }, '+ İş emri')),
      h('div', { class: 'kpis' },
        SP.kpi('Cari bakiye', money(bal), bal > 0 ? 'müşterinin borcu' : 'borç yok', bal > 0 ? 'neg' : ''),
        SP.kpi('Toplam ciro', money(myInv.filter((i) => i.kind !== 'teklif').reduce((s, i) => s + C.totals(i.lines).total, 0))),
        SP.kpi('Servis ziyareti', myWo.length),
        SP.kpi('Son ziyaret', myWo[0] ? date(myWo[0].createdAt) : '—')),
      (c.taxNo || c.address || c.note || c.email) ? h('div', { class: 'card kv-card' }, h('dl', { class: 'kv' },
        c.email ? [h('dt', null, 'E-posta'), h('dd', null, c.email)] : null,
        c.taxNo ? [h('dt', null, 'Vergi'), h('dd', null, [c.taxOffice, c.taxNo].filter(Boolean).join(' / '))] : null,
        (c.address || c.city) ? [h('dt', null, 'Adres'), h('dd', null, [c.address, c.city].filter(Boolean).join(', '))] : null,
        c.note ? [h('dt', null, 'Not'), h('dd', null, c.note)] : null)) : null,
      h('div', { class: 'row between' }, h('h2', { class: 'sec' }, 'Araçlar'), h('button', { class: 'btn sm ghost', onclick: () => editVehicle(null, c.id, refresh) }, '+ Araç ekle')),
      myV.length ? h('div', { class: 'vehicle-grid' }, myV.map((v) => vehicleCard(v, parts, myWo, refresh))) : h('div', { class: 'empty' }, 'Bu müşterinin kayıtlı aracı yok.'),
      h('h2', { class: 'sec' }, 'Servis geçmişi'),
      table(myWo, [
        { label: 'No', get: (w) => h('b', null, w.no) }, { label: 'Tarih', get: (w) => date(w.createdAt) },
        { label: 'Araç', get: (w) => vMap[w.vehicleId] ? h('span', { class: 'plate' }, vMap[w.vehicleId].plate) : '—' },
        { label: 'Şikayet', get: (w) => w.complaint || '—' }, { label: 'Km', get: (w) => (w.km ? num(w.km) : '—') },
        { label: 'Durum', get: (w) => badge(C.WO_STATUS[w.status].label, C.WO_STATUS[w.status].kind) },
        { label: 'Tutar', class: 'right', get: (w) => money(C.totals(w.lines).total) },
      ], { empty: 'Henüz iş emri yok.', onRow: (w) => SP.go('is-emri--' + w.id) }),
      h('h2', { class: 'sec' }, 'Faturalar'),
      table(myInv, [
        { label: 'No', get: (i) => h('b', null, i.no) }, { label: 'Tarih', get: (i) => date(i.date) },
        { label: 'Durum', get: (i) => { const s = C.invoiceStatus(i, pay); return badge(s.label, s.kind); } },
        { label: 'Tutar', class: 'right', get: (i) => money(C.totals(i.lines).total) },
      ], { empty: 'Fatura yok.', onRow: (i) => SP.go('fatura--' + i.id) }));
  };

  function vehicleCard(v, parts, wos, refresh) {
    const last = wos.find((w) => w.vehicleId === v.id);
    const fits = parts.filter((p) => C.partFits(p, v));
    return h('div', { class: 'card vehicle' },
      h('div', { class: 'row between' }, h('span', { class: 'plate lg' }, v.plate), h('button', { class: 'btn sm ghost', onclick: () => editVehicle(v, v.customerId, refresh) }, 'Düzenle')),
      h('b', null, [v.make, v.model, v.year].filter(Boolean).join(' ')),
      h('div', { class: 'muted small' }, [v.engine, v.fuel, v.km ? num(v.km) + ' km' : '', v.color].filter(Boolean).join(' · ')),
      v.vin ? h('div', { class: 'muted small mono' }, 'Şasi: ' + v.vin) : null,
      h('div', { class: 'muted small' }, 'Son servis: ' + (last ? date(last.createdAt) : '—')),
      h('div', { class: 'row gap' },
        h('button', { class: 'btn sm primary', onclick: () => SP.newWorkOrder({ customerId: v.customerId, vehicleId: v.id }) }, 'İş emri aç'),
        h('button', { class: 'btn sm ghost', onclick: () => SP.showFits(v, fits) }, `Uyumlu parçalar (${fits.length})`)));
  }
})();
