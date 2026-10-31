/* Bakım hatırlatma, raporlar, servis logosu, hatırlatma ayarları */
(function () {
  const SP = window.SP;
  const { h, toast, money, num, date, table, badge, pageHead, formModal, pad } = SP.ui;
  const C = SP.core;
  const isoDay = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const addMonths = (d, m) => { const x = new Date(d); x.setMonth(x.getMonth() + m); return x; };

  SP.can = (perm) => {
    const owner = SP.session && SP.session.isOwner;
    return { reports: owner, costs: owner, cash: owner, settings: owner }[perm] ?? true;
  };

  /* ---------- Teslimde bir sonraki bakımı planla ---------- */
  SP.planNextService = async (vehicleId, km) => {
    const t = SP.session.tenant;
    const kmStep = Number(t.serviceKm) || 10000, months = Number(t.serviceMonths) || 12;
    const data = { lastServiceAt: new Date().toISOString(), nextServiceDate: isoDay(addMonths(new Date(), months)), remindedAt: null };
    if (km) data.nextServiceKm = Number(km) + kmStep;
    await C.update('vehicles', vehicleId, data);
  };

  /* ---------- Hatırlatmalar sayfası ---------- */
  SP.pages.hatirlatma = async (view) => {
    const [vs, cs] = await Promise.all([C.all('vehicles', true), C.all('customers')]);
    const cMap = C.byId(cs);
    const today = SP.ui.today();
    const soon = isoDay(new Date(Date.now() + 30 * 86400000));
    let tab = 'yakin';
    const box = h('div'), tabs = h('div', { class: 'tabs' });
    const due = vs.filter((v) => v.nextServiceDate).sort((a, b) => a.nextServiceDate.localeCompare(b.nextServiceDate));
    const groups = {
      gecmis: due.filter((v) => v.nextServiceDate < today),
      yakin: due.filter((v) => v.nextServiceDate >= today && v.nextServiceDate <= soon),
      tum: due,
    };
    const draw = () => {
      tabs.replaceChildren(...[['gecmis', 'Süresi geçmiş'], ['yakin', '30 gün içinde'], ['tum', 'Tümü']].map(([k, l]) =>
        h('button', { class: 'tab' + (tab === k ? ' on' : ''), onclick: () => { tab = k; draw(); } }, l, h('span', { class: 'cnt' }, groups[k].length))));
      box.replaceChildren(table(groups[tab], [
        { label: 'Araç', get: (v) => h('div', null, h('span', { class: 'plate' }, v.plate), h('div', { class: 'muted small' }, [v.make, v.model, v.year].filter(Boolean).join(' '))) },
        { label: 'Müşteri', get: (v) => { const c = cMap[v.customerId] || {}; return h('div', null, c.name || '—', h('div', { class: 'muted small' }, c.phone || '')); } },
        { label: 'Bakım tarihi', get: (v) => badge(date(v.nextServiceDate), v.nextServiceDate < today ? 'err' : v.nextServiceDate <= soon ? 'warn' : '') },
        { label: 'Bakım km', class: 'right', get: (v) => (v.nextServiceKm ? num(v.nextServiceKm) + ' km' : '—') },
        { label: 'Son servis', get: (v) => date(v.lastServiceAt) },
        { label: '', class: 'right nowrap', get: (v) => {
          const c = cMap[v.customerId] || {};
          const msg = `Merhaba ${c.name || ''}, ${v.plate} plakalı aracınızın periyodik bakım zamanı ${v.nextServiceDate < today ? 'geldi' : date(v.nextServiceDate) + ' tarihinde doluyor'}.${v.nextServiceKm ? ` (Bakım km: ${num(v.nextServiceKm)})` : ''} Randevu için bize yazabilir veya arayabilirsiniz. ${SP.session.tenant.name}${SP.session.tenant.phone ? ' · ' + SP.session.tenant.phone : ''}`;
          return [
            v.remindedAt ? h('span', { class: 'muted small' }, 'Hatırlatıldı ' + date(v.remindedAt) + ' ') : null,
            c.phone ? h('a', { class: 'btn sm primary', href: SP.waLink(c.phone, msg), target: '_blank', rel: 'noopener', onclick: () => { C.update('vehicles', v.id, { remindedAt: new Date().toISOString() }).then(() => setTimeout(SP.refresh, 400)); } }, 'WhatsApp hatırlat') : null,
            h('button', { class: 'btn sm ghost', onclick: () => SP.editAppt && SP.editAppt({ vehicleId: v.id, customerId: v.customerId, note: 'Periyodik bakım' }, () => SP.go('randevular')) }, 'Randevu'),
          ];
        } },
      ], { empty: tab === 'gecmis' ? 'Süresi geçmiş bakım yok.' : 'Bu aralıkta bakımı gelen araç yok.', onRow: (v) => SP.go('musteri--' + v.customerId) }));
    };
    view.append(pageHead('Bakım hatırlatma', 'Teslim edilen araçlar için bir sonraki bakım otomatik planlanır. Müşteriye tek tıkla hatırlatın, servisinize geri gelsin.'), h('div', { class: 'toolbar' }, tabs), box);
    draw();
  };

  /* ---------- Raporlar ---------- */
  SP.pages.raporlar = async (view) => {
    if (!SP.can('reports')) { view.append(h('div', { class: 'empty err' }, 'Raporları yalnızca servis yöneticisi görebilir.')); return; }
    const [inv, pay, wos, parts] = await Promise.all([C.all('invoices'), C.all('payments'), C.all('workorders'), C.all('parts')]);
    const pMap = C.byId(parts);
    let month = new Date().toISOString().slice(0, 7);
    const box = h('div');
    const bars = (rows, fmt = money) => {
      const max = Math.max(1, ...rows.map((r) => r[1]));
      return rows.length ? h('div', { class: 'hbars' }, rows.map(([l, v, sub]) => h('div', { class: 'hbar' }, h('span', { class: 'hb-l' }, l), h('div', { class: 'hb-t' }, h('i', { style: { width: (v / max * 100) + '%' } })), h('b', null, fmt(v)), sub ? h('small', { class: 'muted' }, sub) : null))) : h('div', { class: 'empty' }, 'Bu ay veri yok.');
    };
    const draw = () => {
      const mi = inv.filter((i) => i.kind !== 'teklif' && String(i.date).slice(0, 7) === month);
      const mp = pay.filter((p) => String(p.date).slice(0, 7) === month);
      const mw = wos.filter((w) => String(w.createdAt).slice(0, 7) === month);
      let ciro = 0, partsNet = 0, labor = 0, cost = 0;
      const partAgg = {};
      mi.forEach((i) => {
        const t = C.totals(i.lines); ciro += t.total; partsNet += t.parts; labor += t.labor;
        (i.lines || []).filter((l) => l.type === 'parca').forEach((l) => {
          const p = l.partId && pMap[l.partId]; const q = Number(l.qty) || 0;
          if (p) cost += q * (Number(p.buy) || 0);
          const k = l.name; partAgg[k] = partAgg[k] || [0, 0]; partAgg[k][0] += q; partAgg[k][1] += q * (Number(l.price) || 0) * (1 - (Number(l.discount) || 0) / 100);
        });
      });
      const tahsil = mp.reduce((s, p) => s + Number(p.amount), 0);
      const tech = {};
      mw.forEach((w) => { const k = w.technician || '—'; tech[k] = tech[k] || [0, 0]; tech[k][0]++; tech[k][1] += C.totals(w.lines).net; });
      const byMethod = {}; mp.forEach((p) => { byMethod[p.method] = (byMethod[p.method] || 0) + Number(p.amount); });
      const M = Object.fromEntries(C.PAY_METHODS);
      box.replaceChildren(
        h('div', { class: 'kpis' },
          SP.kpi('Fatura cirosu (KDV dahil)', money(ciro), `${mi.length} fatura`),
          SP.kpi('Tahsilat', money(tahsil), `${mp.length} ödeme`),
          SP.kpi('İşçilik (KDV hariç)', money(labor)),
          SP.kpi('Parça kârı (tahmini)', money(partsNet - cost), partsNet ? `%${Math.round((partsNet - cost) / partsNet * 100)} marj` : null, partsNet - cost < 0 ? 'neg' : '')),
        h('div', { class: 'kpis' },
          SP.kpi('Açılan iş emri', mw.length),
          SP.kpi('Ortalama iş emri', money(mw.length ? mw.reduce((s, w) => s + C.totals(w.lines).total, 0) / mw.length : 0)),
          SP.kpi('Parça satışı (KDV hariç)', money(partsNet)),
          SP.kpi('Teslim edilen araç', mw.filter((w) => w.status === 'teslim').length)),
        h('div', { class: 'grid2' },
          h('section', null, h('h2', { class: 'sec' }, 'Usta bazında (KDV hariç)'), bars(Object.entries(tech).sort((a, b) => b[1][1] - a[1][1]).map(([k, [n, v]]) => [k, v, `${n} iş emri`]))),
          h('section', null, h('h2', { class: 'sec' }, 'Tahsilat şekli'), bars(Object.entries(byMethod).sort((a, b) => b[1] - a[1]).map(([k, v]) => [M[k] || k, v])))),
        h('h2', { class: 'sec' }, 'En çok satan parçalar'),
        bars(Object.entries(partAgg).sort((a, b) => b[1][1] - a[1][1]).slice(0, 10).map(([k, [q, v]]) => [k, v, `${num(q)} adet`])),
        h('p', { class: 'muted small' }, 'Parça kârı, satış tutarından stok kartındaki güncel alış fiyatı düşülerek hesaplanır; stok dışı parçalar maliyete dahil değildir.'));
    };
    view.append(pageHead('Raporlar', 'Aylık ciro, tahsilat, kârlılık ve usta performansı.',
      h('input', { type: 'month', id: 'rp_month', class: 'month', value: month, 'aria-label': 'Ay', onchange: (e) => { month = e.target.value; draw(); } })), box);
    draw();
  };

  /* ---------- Ayarlar: logo ---------- */
  SP.logoCard = () => {
    const t = SP.session.tenant;
    const prev = h('div', { class: 'logo-prev' }, t.logo ? h('img', { src: t.logo, alt: 'Servis logosu' }) : h('span', { class: 'muted small' }, 'Logo yok'));
    const input = h('input', { type: 'file', id: 'logo_file', accept: 'image/png,image/jpeg,image/webp', onchange: async () => {
      const f = input.files[0]; if (!f) return;
      if (!SP.session.isOwner) return toast('Logoyu yalnızca servis sahibi değiştirebilir.', 'err');
      try {
        const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(f); });
        const s = Math.min(1, 360 / img.width, 160 / img.height);
        const cv = document.createElement('canvas'); cv.width = Math.round(img.width * s); cv.height = Math.round(img.height * s);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        let url = cv.toDataURL('image/png');
        if (url.length > 150000) url = cv.toDataURL('image/jpeg', 0.85);
        await SP.api.updateTenant({ logo: url }); toast('Logo kaydedildi'); SP.refresh();
      } catch (e) { toast('Logo yüklenemedi: ' + (e.message || 'geçersiz dosya'), 'err'); }
    } });
    return [h('h2', { class: 'sec' }, 'Logo'), h('div', { class: 'card row between' },
      h('div', { class: 'row gap' }, prev, h('span', { class: 'muted small' }, 'Faturada, teklifte ve müşteriye giden durum sayfasında görünür. PNG veya JPG.')),
      h('div', { class: 'row gap' }, h('label', { class: 'btn ghost', for: 'logo_file' }, t.logo ? 'Değiştir' : 'Logo yükle', input),
        t.logo ? h('button', { class: 'btn ghost', onclick: async () => { await SP.api.updateTenant({ logo: null }); SP.refresh(); } }, 'Kaldır') : null))];
  };

  /* ---------- Ayarlar: bakım aralığı ---------- */
  SP.reminderSettings = () => {
    const t = SP.session.tenant;
    const fields = [
      { name: 'serviceKm', label: 'Bakım aralığı (km)', type: 'number', min: 1000, step: 1000, default: 10000 },
      { name: 'serviceMonths', label: 'Bakım aralığı (ay)', type: 'number', min: 1, default: 12 },
    ];
    const form = h('form', { class: 'grid-form card', onsubmit: async (e) => {
      e.preventDefault();
      if (!SP.session.isOwner) return toast('Yalnızca servis sahibi değiştirebilir.', 'err');
      try { await SP.api.updateTenant(SP.ui.readForm(form, fields)); toast('Bakım aralığı kaydedildi'); } catch (err) { toast(err.message, 'err'); }
    } }, fields.map((f) => SP.ui.field(f, t[f.name])), h('p', { class: 'span2 muted small' }, 'Araç teslim edildiğinde bir sonraki bakım bu aralığa göre planlanır ve Bakım hatırlatma listesine düşer.'),
    h('div', { class: 'span2 right' }, h('button', { class: 'btn primary', type: 'submit' }, 'Kaydet')));
    return [h('h2', { class: 'sec' }, 'Bakım hatırlatma'), form];
  };
})();
