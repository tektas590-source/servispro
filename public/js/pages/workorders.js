/* İş emirleri: araç kabul, işlem kalemleri, stok düşümü, faturaya dönüştürme */
(function () {
  const SP = window.SP;
  const { h, toast, money, num, date, dateTime, table, badge, pageHead, formModal, modal, confirmBox, searchBox, norm, pad } = SP.ui;
  const C = SP.core;

  async function monthlyCheck() {
    const max = C.limits().workOrdersPerMonth;
    if (max == null) return;
    const ym = new Date().toISOString().slice(0, 7);
    const n = (await C.all('workorders')).filter((w) => String(w.createdAt).slice(0, 7) === ym).length;
    if (n >= max) throw C.limitError('workOrdersPerMonth', max);
  }

  // Müşteri + araç seçici (yeni iş emri / randevu ortak)
  SP.customerVehicleFields = async (pre = {}) => {
    const [cs, vs] = await Promise.all([C.all('customers'), C.all('vehicles')]);
    const cMap = C.byId(cs);
    const vOpts = () => [['', '— Araç seçin —'], ...vs.map((v) => [v.id, `${v.plate} · ${v.make} ${v.model}${cMap[v.customerId] ? ' — ' + cMap[v.customerId].name : ''}`])];
    return {
      fields: [{ name: 'vehicleId', label: 'Araç (plaka)', type: 'select', required: true, span: 2, options: vOpts, hint: 'Listede yoksa önce müşteri ve aracı kaydedin.' }],
      resolve: (d) => { const v = vs.find((x) => x.id === d.vehicleId); if (!v) throw new Error('Araç seçin'); return { vehicleId: v.id, customerId: v.customerId, vehicle: v }; },
      initial: { vehicleId: pre.vehicleId || '' },
      empty: !vs.length,
    };
  };

  SP.newWorkOrder = async (pre = {}) => {
    if (!C.guardWrite()) return;
    try { await monthlyCheck(); } catch (e) { return toast(e.message, 'err'); }
    const cv = await SP.customerVehicleFields(pre);
    if (cv.empty) { toast('Önce bir müşteri ve araç kaydedin.', 'err'); SP.go('musteriler'); return; }
    const users = SP.session.user.name || '';
    formModal('Araç kabul — yeni iş emri', [
      ...cv.fields,
      { name: 'km', label: 'Geliş kilometresi', type: 'number', min: 0 },
      { name: 'technician', label: 'Sorumlu usta', default: users },
      { name: 'complaint', label: 'Müşteri şikayeti / talep', type: 'textarea', span: 2, required: true, rows: 3, default: pre.complaint },
      { name: 'promised', label: 'Söz verilen teslim', type: 'datetime-local' },
      { name: 'fuelLevel', label: 'Yakıt seviyesi', type: 'select', options: [['', '—'], ['1/4', '1/4'], ['1/2', '1/2'], ['3/4', '3/4'], ['dolu', 'Dolu']] },
    ], cv.initial, async (d) => {
      const r = cv.resolve(d);
      const n = await SP.api.nextNo('workorder');
      const wo = { no: 'IE-' + String(n).padStart(4, '0'), customerId: r.customerId, vehicleId: r.vehicleId, km: d.km, technician: d.technician, complaint: d.complaint, promised: d.promised, fuelLevel: d.fuelLevel, diagnosis: '', status: 'acik', lines: [], stockApplied: false, appointmentId: pre.appointmentId || null };
      const id = await C.add('workorders', wo);
      if (d.km && (!r.vehicle.km || d.km > r.vehicle.km)) await C.update('vehicles', r.vehicleId, { km: d.km });
      if (pre.appointmentId) await C.update('appointments', pre.appointmentId, { status: 'geldi', workOrderId: id });
      toast(wo.no + ' açıldı'); SP.go('is-emri--' + id);
    }, { wide: true, saveText: 'İş emrini aç' });
  };

  /* ------------------------------ Liste */
  SP.pages['is-emirleri'] = async (view, r) => {
    const [wos, cs, vs] = await Promise.all([C.all('workorders'), C.all('customers'), C.all('vehicles')]);
    const cMap = C.byId(cs), vMap = C.byId(vs);
    let tab = r.query.durum || 'aktif', q = '';
    const box = h('div'), tabs = h('div', { class: 'tabs' });
    const TABS = [['aktif', 'Serviste'], ['hazir', 'Teslime hazır'], ['teslim', 'Teslim edilen'], ['tum', 'Tümü']];
    const draw = () => {
      tabs.replaceChildren(...TABS.map(([k, l]) => {
        const cnt = wos.filter((w) => match(w, k)).length;
        return h('button', { class: 'tab' + (tab === k ? ' on' : ''), onclick: () => { tab = k; draw(); } }, l, h('span', { class: 'cnt' }, cnt));
      }));
      const rows = wos.filter((w) => match(w, tab)).filter((w) => !q || norm([w.no, w.complaint, w.technician, cMap[w.customerId] && cMap[w.customerId].name, vMap[w.vehicleId] && vMap[w.vehicleId].plate].join(' ')).includes(q))
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      box.replaceChildren(table(rows, [
        { label: 'No', get: (w) => h('b', null, w.no) },
        { label: 'Araç', get: (w) => { const v = vMap[w.vehicleId]; return v ? h('div', null, h('span', { class: 'plate' }, v.plate), h('div', { class: 'muted small' }, `${v.make} ${v.model}`)) : '—'; } },
        { label: 'Müşteri', get: (w) => (cMap[w.customerId] || {}).name || '—' },
        { label: 'Şikayet', get: (w) => h('span', { class: 'clip' }, w.complaint || '—') },
        { label: 'Usta', get: (w) => w.technician || '—' },
        { label: 'Giriş', get: (w) => date(w.createdAt) },
        { label: 'Durum', get: (w) => badge(C.WO_STATUS[w.status].label, C.WO_STATUS[w.status].kind) },
        { label: 'Tutar', class: 'right', get: (w) => money(C.totals(w.lines).total) },
      ], { empty: 'Bu listede iş emri yok.', onRow: (w) => SP.go('is-emri--' + w.id) }));
    };
    const match = (w, k) => k === 'tum' || (k === 'aktif' ? ['acik', 'islemde', 'parca'].includes(w.status) : w.status === k);
    view.append(pageHead('İş emirleri', null, h('button', { class: 'btn primary', onclick: () => SP.newWorkOrder() }, '+ Araç kabul')),
      h('div', { class: 'toolbar' }, tabs, searchBox('No, plaka, müşteri…', (v) => { q = v; draw(); })), box);
    draw();
  };

  /* ------------------------------ Detay */
  SP.pages['is-emri'] = async (view, r) => {
    const [wos, cs, vs, parts] = await Promise.all([C.all('workorders', true), C.all('customers'), C.all('vehicles'), C.all('parts', true)]);
    const src = wos.find((w) => w.id === r.id);
    if (!src) { view.append(h('div', { class: 'empty' }, 'İş emri bulunamadı.')); return; }
    const wo = JSON.parse(JSON.stringify(src));
    wo.lines = wo.lines || [];
    const c = C.byId(cs)[wo.customerId] || {}, v = C.byId(vs)[wo.vehicleId] || {};
    const pMap = C.byId(parts);
    const locked = wo.status === 'teslim' || wo.status === 'iptal' || !!wo.invoiceId;
    let dirty = false;

    const saveBtn = h('button', { class: 'btn primary', onclick: () => save() }, 'Kaydet');
    const setDirty = () => { dirty = true; saveBtn.classList.add('pulse'); saveBtn.textContent = 'Kaydet •'; };
    async function save(extra = {}) {
      Object.assign(wo, extra);
      await C.update('workorders', wo.id, { lines: wo.lines, diagnosis: wo.diagnosis, technician: wo.technician, km: wo.km, complaint: wo.complaint, note: wo.note || '', status: wo.status, stockApplied: !!wo.stockApplied, invoiceId: wo.invoiceId || null, deliveredAt: wo.deliveredAt || null });
      dirty = false; saveBtn.classList.remove('pulse'); saveBtn.textContent = 'Kaydet';
      toast('Kaydedildi');
    }
    window.onbeforeunload = () => (dirty ? 'Kaydedilmemiş değişiklikler var' : undefined);
    window.addEventListener('hashchange', () => { window.onbeforeunload = null; }, { once: true });

    // Stok düşümü — iş emri "Hazır" veya "Teslim" olduğunda bir kez
    async function applyStock(sign) {
      for (const l of wo.lines.filter((x) => x.type === 'parca' && x.partId)) {
        const p = (await C.all('parts', true)).find((x) => x.id === l.partId);
        if (!p) continue;
        await C.update('parts', p.id, { stock: (Number(p.stock) || 0) - sign * (Number(l.qty) || 0) });
        await C.add('stockMoves', { partId: p.id, qty: -sign * (Number(l.qty) || 0), type: 'servis', note: wo.no + (sign < 0 ? ' (iptal iadesi)' : ''), date: SP.ui.today() });
      }
    }
    async function setStatus(st) {
      if (!C.guardWrite()) return;
      const extra = { status: st };
      if ((st === 'hazir' || st === 'teslim') && !wo.stockApplied) { wo.status = st; await applyStock(1); extra.stockApplied = true; }
      if (st === 'iptal' && wo.stockApplied) { await applyStock(-1); extra.stockApplied = false; }
      if (st === 'teslim') extra.deliveredAt = new Date().toISOString();
      await save(extra); SP.refresh();
    }

    /* Kalem tablosu */
    const linesBox = h('div'), totBox = h('div', { class: 'totals' });
    const drawLines = () => {
      const rows = wo.lines.map((l, i) => {
        const inp = (k, type = 'number', cls = '') => h('input', { class: 'cell ' + cls, type, step: type === 'number' ? 'any' : null, min: type === 'number' ? 0 : null, value: l[k] ?? '', disabled: locked,
          oninput: (e) => { l[k] = type === 'number' ? Number(e.target.value) : e.target.value; setDirty(); drawTotals(); rowTotal.textContent = money(lineNet(l)); } });
        const rowTotal = h('span', null, money(lineNet(l)));
        const p = l.partId && pMap[l.partId];
        const fit = p && v.make ? C.partFits(p, v) : null;
        return h('tr', null,
          h('td', { 'data-label': 'Tür' }, badge(l.type === 'parca' ? 'Parça' : 'İşçilik', l.type === 'parca' ? 'info' : '')),
          h('td', { 'data-label': 'Açıklama' }, inp('name', 'text', 'wide'), p ? h('div', { class: 'muted small' }, p.code, ' · stok ', num(p.stock), fit === false && C.limits().compat && (p.compat || []).length ? h('span', { class: 'badge err' }, 'Uyumsuz olabilir') : fit ? h('span', { class: 'badge ok' }, 'Uyumlu') : null) : null),
          h('td', { 'data-label': 'Miktar' }, inp('qty')),
          h('td', { 'data-label': 'Birim fiyat' }, inp('price')),
          h('td', { 'data-label': 'İsk. %' }, inp('discount')),
          h('td', { 'data-label': 'KDV %' }, inp('vat')),
          h('td', { 'data-label': 'Tutar', class: 'right' }, rowTotal),
          h('td', { class: 'right' }, locked ? '' : h('button', { class: 'icon-btn', 'aria-label': 'Kalemi sil', onclick: () => { wo.lines.splice(i, 1); setDirty(); drawLines(); } }, '✕')));
      });
      linesBox.replaceChildren(wo.lines.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'lines' },
        h('thead', null, h('tr', null, ['Tür', 'Açıklama', 'Miktar', 'Birim fiyat', 'İsk. %', 'KDV %', 'Tutar', ''].map((x, i) => h('th', { class: i === 6 ? 'right' : null }, x)))), h('tbody', null, rows)))
        : h('div', { class: 'empty' }, 'Henüz kalem yok. Parça veya işçilik ekleyin.'));
      drawTotals();
    };
    const lineNet = (l) => (Number(l.qty) || 0) * (Number(l.price) || 0) * (1 - (Number(l.discount) || 0) / 100);
    const drawTotals = () => { const t = C.totals(wo.lines); totBox.replaceChildren(
      h('div', null, h('span', null, 'Parça'), h('span', null, money(t.parts))), h('div', null, h('span', null, 'İşçilik'), h('span', null, money(t.labor))),
      h('div', null, h('span', null, 'Ara toplam'), h('span', null, money(t.net))), h('div', null, h('span', null, 'KDV'), h('span', null, money(t.vat))),
      h('div', { class: 'grand' }, h('span', null, 'Genel toplam'), h('b', null, money(t.total)))); };

    function addLabor() {
      formModal('İşçilik ekle', [
        { name: 'name', label: 'İşlem', required: true, span: 2, list: 'labors' },
        { name: 'qty', label: 'Süre / adet', type: 'number', step: 'any', default: 1 },
        { name: 'price', label: 'Birim ücret (KDV hariç)', type: 'number', step: '0.01', required: true },
      ], null, async (d) => { wo.lines.push({ type: 'iscilik', name: d.name, qty: d.qty || 1, price: d.price, vat: SP.VAT_DEFAULT, discount: 0 }); setDirty(); drawLines(); },
      { saveText: 'Ekle', extra: h('datalist', { id: 'labors' }, ['Periyodik bakım işçiliği', 'Arıza tespit (diagnostik)', 'Fren balatası değişimi', 'Debriyaj değişimi', 'Triger seti değişimi', 'Rot balans', 'Klima gazı dolumu', 'Akü değişimi', 'Motor yağı değişimi'].map((x) => h('option', { value: x }))) });
    }
    function addPart() {
      let q = '';
      const listBox = h('div', { class: 'picker' });
      const compatOn = C.limits().compat && v.make;
      const draw = () => {
        const rows = parts.filter((p) => !q || norm([p.code, p.name, p.brand, p.oem].join(' ')).includes(q))
          .map((p) => ({ p, fit: compatOn ? C.partFits(p, v) : false }))
          .sort((a, b) => (b.fit - a.fit) || a.p.name.localeCompare(b.p.name, 'tr')).slice(0, 60);
        listBox.replaceChildren(...[].concat(rows.length ? rows.map(({ p, fit }) => h('button', { class: 'pick', onclick: () => {
          wo.lines.push({ type: 'parca', partId: p.id, name: p.name + (p.brand ? ' (' + p.brand + ')' : ''), qty: 1, price: Number(p.sell) || 0, vat: p.vat ?? SP.VAT_DEFAULT, discount: 0 });
          setDirty(); drawLines(); m.close();
        } }, h('div', null, h('b', null, p.name), ' ', fit ? badge('Uyumlu', 'ok') : null, h('div', { class: 'muted small' }, [p.code, p.brand, p.oem].filter(Boolean).join(' · '))),
        h('div', { class: 'right' }, h('div', null, money(p.sell)), SP.stockBadge(p)))) : h('div', { class: 'empty' }, 'Parça bulunamadı')));
      };
      const free = h('button', { class: 'btn ghost sm', onclick: () => { m.close(); formModal('Stok dışı parça', [
        { name: 'name', label: 'Parça adı', required: true, span: 2 }, { name: 'qty', label: 'Miktar', type: 'number', step: 'any', default: 1 },
        { name: 'price', label: 'Birim fiyat (KDV hariç)', type: 'number', step: '0.01', required: true }],
      null, async (d) => { wo.lines.push({ type: 'parca', partId: null, name: d.name, qty: d.qty || 1, price: d.price, vat: SP.VAT_DEFAULT, discount: 0 }); setDirty(); drawLines(); }, { saveText: 'Ekle' }); } }, 'Stokta olmayan parça ekle');
      const m = modal('Parça ekle', h('div', { class: 'stack' },
        compatOn ? h('p', { class: 'muted small' }, `${v.make} ${v.model} ${v.year || ''} ${v.engine || ''} ile uyumlu parçalar üstte gösterilir.`) : null,
        searchBox('Parça adı, kod, OEM no…', (x) => { q = x; draw(); }), listBox, free), { wide: true });
      draw();
    }

    async function toInvoice(kind) {
      if (dirty) await save();
      if (!wo.lines.length) return toast('Önce kalem ekleyin.', 'err');
      if (!C.guardWrite()) return;
      const n = await SP.api.nextNo(kind === 'teklif' ? 'quote' : 'invoice');
      const year = new Date().getFullYear();
      const no = (kind === 'teklif' ? 'TKL-' : 'FTR-') + year + '-' + String(n).padStart(4, '0');
      const id = await C.add('invoices', { no, kind, customerId: wo.customerId, vehicleId: wo.vehicleId, workOrderId: wo.id, km: wo.km, date: SP.ui.today(), lines: wo.lines, note: '' });
      if (kind === 'fatura') await save({ invoiceId: id });
      C.invalidate('invoices');
      toast(no + ' oluşturuldu'); SP.go('fatura--' + id);
    }

    const st = C.WO_STATUS[wo.status];
    const statusSel = h('select', { class: 'status-select', disabled: wo.status === 'teslim' && !!wo.invoiceId, onchange: (e) => setStatus(e.target.value) },
      Object.entries(C.WO_STATUS).map(([k, s]) => h('option', { value: k, selected: k === wo.status }, s.label)));
    const textArea = (k, label, rows = 2) => h('label', { class: 'field' }, h('span', null, label), Object.assign(h('textarea', { rows, disabled: locked, oninput: (e) => { wo[k] = e.target.value; setDirty(); } }), { value: wo[k] || '' }));

    view.append(
      pageHead(`İş emri ${wo.no}`, `${dateTime(wo.createdAt)} · ${st.label}`,
        h('button', { class: 'btn ghost', onclick: () => printWorkOrder(wo, c, v) }, 'Yazdır'),
        !wo.invoiceId ? h('button', { class: 'btn ghost', onclick: () => toInvoice('teklif') }, 'Teklif oluştur') : null,
        wo.invoiceId ? h('a', { class: 'btn ghost', href: '#fatura--' + wo.invoiceId }, 'Faturayı aç') : h('button', { class: 'btn ghost', onclick: () => toInvoice('fatura') }, 'Fatura kes'),
        locked ? null : saveBtn),
      h('div', { class: 'wo-head card' },
        h('div', null, h('small', { class: 'muted' }, 'Araç'), h('div', null, h('span', { class: 'plate lg' }, v.plate || '—')), h('div', null, [v.make, v.model, v.year, v.engine].filter(Boolean).join(' · ')), h('div', { class: 'muted small' }, 'Geliş: ' + (wo.km ? num(wo.km) + ' km' : '—'))),
        h('div', null, h('small', { class: 'muted' }, 'Müşteri'), h('div', null, h('a', { href: '#musteri--' + c.id }, h('b', null, c.name || '—'))), c.phone ? h('a', { href: 'tel:' + String(c.phone).replace(/\s/g, '') }, c.phone) : null),
        h('div', null, h('small', { class: 'muted' }, 'Durum'), statusSel, h('div', { class: 'muted small' }, 'Usta: ' + (wo.technician || '—'))),
      ),
      h('div', { class: 'grid2' }, textArea('complaint', 'Müşteri şikayeti'), textArea('diagnosis', 'Tespit / yapılan işlem')),
      h('div', { class: 'row between' }, h('h2', { class: 'sec' }, 'Parça & işçilik'),
        locked ? h('span', { class: 'muted small' }, wo.invoiceId ? 'Faturası kesildi — kalemler kilitli.' : 'Kapalı iş emri') : h('div', { class: 'row gap' },
          h('button', { class: 'btn sm ghost', onclick: addLabor }, '+ İşçilik'), h('button', { class: 'btn sm primary', onclick: addPart }, '+ Parça'))),
      linesBox, totBox,
      h('div', { class: 'row between danger-zone' }, h('span', { class: 'muted small' }, wo.stockApplied ? 'Parçalar stoktan düşüldü.' : 'Parçalar, iş emri “Hazır” veya “Teslim edildi” yapılınca stoktan düşer.'),
        !wo.invoiceId ? h('button', { class: 'btn sm ghost', onclick: async () => {
          if (!(await confirmBox(`${wo.no} silinsin mi?` + (wo.stockApplied ? ' Düşülen parçalar stoğa geri eklenir.' : '')))) return;
          if (wo.stockApplied) await applyStock(-1);
          await C.remove('workorders', wo.id); SP.go('is-emirleri');
        } }, 'İş emrini sil') : null));
    drawLines();
  };

  /* Yazdırılabilir araç kabul / iş emri formu */
  function printWorkOrder(wo, c, v) {
    const t = SP.session.tenant, tot = C.totals(wo.lines);
    SP.printDoc(h('div', { class: 'doc' },
      h('div', { class: 'doc-head' }, h('div', null, h('h2', null, t.name), h('div', null, t.address), h('div', null, t.phone)),
        h('div', { class: 'right' }, h('h1', null, 'İŞ EMRİ'), h('div', null, 'No: ', h('b', null, wo.no)), h('div', null, 'Tarih: ' + dateTime(wo.createdAt)))),
      h('div', { class: 'doc-2col' },
        h('div', null, h('h4', null, 'Müşteri'), h('div', null, c.name), h('div', null, c.phone)),
        h('div', null, h('h4', null, 'Araç'), h('div', null, h('b', null, v.plate), ' · ', [v.make, v.model, v.year].filter(Boolean).join(' ')), h('div', null, 'Şasi: ' + (v.vin || '—')), h('div', null, 'Km: ' + (wo.km ? num(wo.km) : '—') + (wo.fuelLevel ? ' · Yakıt: ' + wo.fuelLevel : '')))),
      h('h4', null, 'Müşteri şikayeti'), h('p', null, wo.complaint || '—'),
      wo.diagnosis ? [h('h4', null, 'Tespit / yapılan işlem'), h('p', null, wo.diagnosis)] : null,
      wo.lines.length ? h('table', null, h('thead', null, h('tr', null, ['Açıklama', 'Miktar', 'Birim', 'Tutar'].map((x) => h('th', null, x)))),
        h('tbody', null, wo.lines.map((l) => h('tr', null, h('td', null, l.name), h('td', null, num(l.qty)), h('td', null, money(l.price)), h('td', { class: 'right' }, money((l.qty || 0) * (l.price || 0) * (1 - (l.discount || 0) / 100))))))) : null,
      wo.lines.length ? h('div', { class: 'doc-total' }, 'Tahmini toplam (KDV dahil): ', h('b', null, money(tot.total))) : null,
      h('div', { class: 'sign' }, h('div', null, 'Teslim eden (müşteri)'), h('div', null, 'Teslim alan (servis)')),
      h('p', { class: 'small' }, 'Aracımı yukarıdaki işlemler için teslim ettim. Ek işlem gerekmesi halinde tarafıma bilgi verilmesini onaylıyorum.')));
  }

  SP.printDoc = (node) => {
    let p = document.getElementById('print-area');
    if (!p) { p = h('div', { id: 'print-area' }); document.body.appendChild(p); }
    p.replaceChildren(node);
    document.body.classList.add('printing');
    setTimeout(() => { window.print(); document.body.classList.remove('printing'); }, 50);
  };
})();
