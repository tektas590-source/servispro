/* Stok & parça kartları, stok hareketleri, parça–araç uyumluluğu */
(function () {
  const SP = window.SP;
  const { h, toast, money, num, date, table, badge, pageHead, formModal, modal, confirmBox, searchBox, norm } = SP.ui;
  const C = SP.core;

  const partFields = [
    { name: 'code', label: 'Stok kodu', required: true }, { name: 'name', label: 'Parça adı', required: true },
    { name: 'brand', label: 'Marka' }, { name: 'oem', label: 'OEM / üretici no' },
    { name: 'unit', label: 'Birim', type: 'select', options: [['adet', 'Adet'], ['takım', 'Takım'], ['litre', 'Litre'], ['metre', 'Metre'], ['kg', 'Kg']] },
    { name: 'shelf', label: 'Raf / konum' },
    { name: 'buy', label: 'Alış fiyatı (KDV hariç)', type: 'number', step: '0.01', min: 0 },
    { name: 'sell', label: 'Satış fiyatı (KDV hariç)', type: 'number', step: '0.01', min: 0, required: true },
    { name: 'vat', label: 'KDV %', type: 'number', min: 0, default: SP.VAT_DEFAULT },
    { name: 'minStock', label: 'Kritik stok seviyesi', type: 'number', min: 0 },
  ];

  /* Uyumluluk kuralı düzenleyici */
  function compatEditor(rules, enabled) {
    const list = h('div', { class: 'compat-list' });
    const rows = [];
    const addRow = (r = {}) => {
      const inp = (k, ph, type = 'text', w) => { const i = h('input', { type, placeholder: ph, 'data-k': k, list: k === 'make' ? 'makes' : null, style: w ? { width: w } : null }); i.value = r[k] ?? ''; return i; };
      const row = h('div', { class: 'compat-row' }, inp('make', 'Marka *'), inp('model', 'Model (boş = tümü)'), inp('yearFrom', 'Yıl ≥', 'number'), inp('yearTo', 'Yıl ≤', 'number'), inp('engine', 'Motor (boş = tümü)'),
        h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Kuralı sil', onclick: () => { row.remove(); rows.splice(rows.indexOf(row), 1); } }, '✕'));
      rows.push(row); list.append(row);
    };
    (rules || []).forEach(addRow);
    const el = h('div', { class: 'span2 compat-box' },
      h('div', { class: 'row between' }, h('b', null, 'Uyumlu araçlar'), enabled ? h('button', { type: 'button', class: 'btn sm ghost', onclick: () => addRow() }, '+ Araç kuralı') : null),
      enabled ? h('p', { class: 'muted small' }, 'Örn. Marka: Peugeot, Model: boş, Yıl: 2012–2022, Motor: 1.6 HDi → tüm 1.6 HDi Peugeot’larla eşleşir.') : h('div', { class: 'upsell' }, 'Parça–araç uyumluluğu Profesyonel ve Kurumsal paketlerde. ', h('a', { href: '#abonelik' }, 'Paketi yükselt')),
      enabled ? list : null,
      h('datalist', { id: 'makes' }, C.MAKES.map((m) => h('option', { value: m }))));
    const read = () => rows.map((row) => {
      const o = {}; row.querySelectorAll('input').forEach((i) => { o[i.dataset.k] = i.type === 'number' ? (i.value ? Number(i.value) : null) : i.value.trim(); }); return o;
    }).filter((o) => o.make);
    return { el, read };
  }

  async function editPart(p, after) {
    if (!p) {
      if (!C.guardWrite()) return;
      const max = C.limits().parts; const n = (await C.all('parts')).length;
      if (max != null && n >= max) return toast(C.limitError('parts', max).message, 'err');
    }
    const ce = compatEditor(p ? p.compat : [], C.limits().compat);
    formModal(p ? 'Parçayı düzenle' : 'Yeni stok kartı', [...partFields.filter((f) => f.name !== 'buy' || SP.can('costs')), ...(p ? [] : [{ name: 'stock', label: 'Açılış stoku', type: 'number', min: 0, default: 0 }])], p || { unit: 'adet', vat: SP.VAT_DEFAULT }, async (d) => {
      const all = await C.all('parts');
      if (all.some((x) => norm(x.code) === norm(d.code) && (!p || x.id !== p.id))) throw new Error('Bu stok kodu zaten kullanılıyor.');
      if (C.limits().compat) d.compat = ce.read(); else if (!p) d.compat = [];
      if (p) await C.update('parts', p.id, d);
      else {
        const stock = Number(d.stock) || 0; d.stock = stock;
        const id = await C.add('parts', d);
        if (stock) await C.add('stockMoves', { partId: id, qty: stock, type: 'giris', note: 'Açılış stoku', date: SP.ui.today() });
      }
      toast('Stok kartı kaydedildi'); after && after();
    }, { wide: true, extra: ce.el });
  }

  // Stok giriş / çıkış / sayım
  async function moveStock(p, after) {
    if (!C.guardWrite()) return;
    formModal(`Stok hareketi — ${p.name}`, [
      { name: 'type', label: 'Hareket', type: 'select', options: [['giris', 'Giriş (alış)'], ['cikis', 'Çıkış (fire / iade)'], ['sayim', 'Sayım düzeltme (yeni miktar)']] },
      { name: 'qty', label: 'Miktar', type: 'number', step: 'any', required: true, min: 0 },
      { name: 'price', label: 'Birim alış fiyatı (girişte)', type: 'number', step: '0.01', min: 0 },
      { name: 'supplier', label: 'Tedarikçi / belge no' },
      { name: 'date', label: 'Tarih', type: 'date', default: SP.ui.today() },
      { name: 'note', label: 'Not' },
    ], { type: 'giris' }, async (d) => {
      const cur = Number(p.stock) || 0; let delta = Number(d.qty) || 0;
      if (d.type === 'cikis') delta = -delta;
      if (d.type === 'sayim') delta = delta - cur;
      const upd = { stock: cur + delta };
      if (d.type === 'giris' && d.price) upd.buy = d.price;
      await C.update('parts', p.id, upd);
      await C.add('stockMoves', { partId: p.id, qty: delta, type: d.type, note: [d.supplier, d.note].filter(Boolean).join(' · '), date: d.date, price: d.price || null });
      toast('Stok güncellendi'); after && after();
    });
  }
  async function history(p) {
    const moves = (await C.all('stockMoves', true)).filter((m) => m.partId === p.id).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    const T = { giris: 'Giriş', cikis: 'Çıkış', sayim: 'Sayım', servis: 'İş emri' };
    modal(`Stok hareketleri — ${p.code}`, table(moves, [
      { label: 'Tarih', get: (m) => date(m.date || m.createdAt) }, { label: 'Hareket', get: (m) => T[m.type] || m.type },
      { label: 'Miktar', class: 'right', get: (m) => h('b', { class: m.qty < 0 ? 'neg' : 'pos' }, (m.qty > 0 ? '+' : '') + num(m.qty)) },
      { label: 'Açıklama', get: (m) => m.note || '—' }], { empty: 'Hareket yok' }), { wide: true });
  }

  SP.showFits = (v, fits) => {
    modal(`${v.plate} · ${[v.make, v.model, v.year, v.engine].filter(Boolean).join(' ')} — uyumlu parçalar`, table(fits, [
      { label: 'Kod', get: (p) => h('b', null, p.code) }, { label: 'Parça', get: (p) => p.name + (p.brand ? ' · ' + p.brand : '') },
      { label: 'Stok', class: 'right', get: (p) => stockBadge(p) }, { label: 'Fiyat', class: 'right', get: (p) => money(p.sell) }],
    { empty: C.limits().compat ? 'Bu araç için tanımlı uyumlu parça yok. Stok kartlarına uyumluluk kuralı ekleyin.' : 'Uyumluluk özelliği paketinizde yok.' }), { wide: true });
  };
  const stockBadge = (p) => { const s = Number(p.stock) || 0; return badge(num(s) + ' ' + (p.unit || ''), s <= 0 ? 'err' : s <= (Number(p.minStock) || 0) ? 'warn' : 'ok'); };
  SP.stockBadge = stockBadge;

  SP.pages.stok = async (view) => {
    const parts = await C.all('parts');
    let q = '', critical = false, fitV = null;
    const box = h('div');
    const fitInfo = h('div');
    const draw = () => {
      let rows = parts.filter((p) => !q || norm([p.code, p.name, p.brand, p.oem, p.shelf].join(' ')).includes(q));
      if (critical) rows = rows.filter((p) => (Number(p.stock) || 0) <= (Number(p.minStock) || 0));
      if (fitV) rows = rows.filter((p) => C.partFits(p, fitV));
      rows.sort((a, b) => a.name.localeCompare(b.name, 'tr'));
      const value = rows.reduce((s, p) => s + (Number(p.stock) || 0) * (Number(p.buy) || 0), 0);
      fitInfo.replaceChildren(fitV ? h('div', { class: 'banner info' }, `Filtre: ${[fitV.make, fitV.model, fitV.year, fitV.engine].filter(Boolean).join(' ')} ile uyumlu parçalar`, h('button', { class: 'btn sm ghost', onclick: () => { fitV = null; draw(); } }, 'Filtreyi kaldır')) : '');
      box.replaceChildren(
        h('p', { class: 'muted small' }, `${rows.length} kart` + (SP.can('costs') ? ` · stok değeri (alış) ${money(value)}` : '')),
        table(rows, [
          { label: 'Kod', get: (p) => h('div', null, h('b', null, p.code), p.oem ? h('div', { class: 'muted small mono' }, p.oem) : null) },
          { label: 'Parça', get: (p) => h('div', null, p.name, h('div', { class: 'muted small' }, [p.brand, p.shelf ? 'Raf ' + p.shelf : ''].filter(Boolean).join(' · '))) },
          { label: 'Uyumluluk', get: (p) => (p.compat && p.compat.length ? h('span', { class: 'small', title: p.compat.map(C.compatText).join('\n') }, p.compat.slice(0, 2).map(C.compatText).join(' | ') + (p.compat.length > 2 ? ` +${p.compat.length - 2}` : '')) : h('span', { class: 'muted small' }, 'Genel')) },
          { label: 'Stok', class: 'right', get: stockBadge },
          { label: 'Satış', class: 'right', get: (p) => money(p.sell) },
          { label: '', class: 'right nowrap', get: (p) => [
            h('button', { class: 'btn sm ghost', onclick: () => moveStock(p, reload) }, '± Stok'),
            h('button', { class: 'btn sm ghost', onclick: () => history(p) }, 'Hareketler')] },
        ], { empty: q || critical || fitV ? 'Filtreyle eşleşen parça yok' : 'Henüz stok kartı yok.', onRow: (p) => editPart(p, reload) }));
    };
    const reload = () => SP.refresh();
    const findFit = () => {
      if (!C.limits().compat) return toast(C.limitError('compat').message, 'err');
      formModal('Araca göre parça bul', [
        { name: 'make', label: 'Marka', required: true, list: 'makes' }, { name: 'model', label: 'Model' },
        { name: 'year', label: 'Yıl', type: 'number' }, { name: 'engine', label: 'Motor' }],
      fitV || {}, async (d) => { fitV = d; draw(); }, { saveText: 'Filtrele', extra: h('datalist', { id: 'makes' }, C.MAKES.map((m) => h('option', { value: m }))) });
    };
    const critBtn = h('label', { class: 'check' }, h('input', { type: 'checkbox', onchange: (e) => { critical = e.target.checked; draw(); } }), h('span', null, 'Sadece kritik stok'));
    view.append(pageHead('Stok & parça', 'Satır üzerine tıklayarak kartı ve uyumluluk kurallarını düzenleyin.',
      h('a', { class: 'btn ghost', href: '#ice-aktar?tur=stok' }, 'Excel’den aktar'), h('button', { class: 'btn ghost', onclick: findFit }, 'Araca göre bul'),
      h('button', { class: 'btn primary', onclick: () => editPart(null, reload) }, '+ Stok kartı')),
    h('div', { class: 'toolbar' }, searchBox('Kod, ad, marka veya OEM no…', (v) => { q = v; draw(); }), critBtn), fitInfo, box);
    draw();
  };
})();
