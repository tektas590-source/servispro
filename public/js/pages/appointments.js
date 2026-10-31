/* Randevular — günlük/haftalık liste, WhatsApp hatırlatma, iş emrine dönüştürme */
(function () {
  const SP = window.SP;
  const { h, toast, table, badge, pageHead, formModal, confirmBox, pad } = SP.ui;
  const C = SP.core;
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const addD = (s, n) => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return iso(d); };
  const dayName = (s) => new Date(s + 'T12:00:00').toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' });

  SP.waLink = (phone, text) => {
    let p = String(phone || '').replace(/\D/g, '');
    if (p.startsWith('0')) p = '9' + p; else if (p.length === 10) p = '90' + p;
    return `https://wa.me/${p}?text=${encodeURIComponent(text)}`;
  };

  async function editAppt(a, after, preDate) {
    if (!a && !C.guardWrite()) return;
    const cv = await SP.customerVehicleFields({ vehicleId: a && a.vehicleId });
    if (cv.empty) { toast('Önce bir müşteri ve araç kaydedin.', 'err'); SP.go('musteriler'); return; }
    formModal(a ? 'Randevuyu düzenle' : 'Yeni randevu', [
      { name: 'date', label: 'Tarih', type: 'date', required: true, default: preDate || SP.ui.today() },
      { name: 'time', label: 'Saat', type: 'time', required: true, default: '09:00' },
      ...cv.fields,
      { name: 'note', label: 'İşlem / not', type: 'textarea', span: 2, rows: 2, placeholder: 'Periyodik bakım, fren kontrolü…' },
    ], { ...(cv.initial), ...(a || {}) }, async (d) => {
      const r = cv.resolve(d);
      const data = { date: d.date, time: d.time, note: d.note, vehicleId: r.vehicleId, customerId: r.customerId };
      if (a) await C.update('appointments', a.id, data); else await C.add('appointments', { ...data, status: 'bekliyor' });
      toast('Randevu kaydedildi'); after();
    }, { wide: true });
  }

  SP.pages.randevular = async (view) => {
    const [as, cs, vs] = await Promise.all([C.all('appointments'), C.all('customers'), C.all('vehicles')]);
    const cMap = C.byId(cs), vMap = C.byId(vs);
    let day = SP.ui.today(), mode = 'gun';
    const box = h('div'), label = h('b', { class: 'day-label' });
    const reload = () => SP.refresh();
    const draw = () => {
      const days = mode === 'gun' ? [day] : Array.from({ length: 7 }, (_, i) => addD(day, i));
      label.textContent = mode === 'gun' ? dayName(day) : `${dayName(days[0])} – ${dayName(days[6])}`;
      box.replaceChildren(...days.map((d) => {
        const rows = as.filter((a) => a.date === d).sort((x, y) => x.time.localeCompare(y.time));
        if (mode === 'hafta' && !rows.length) return null;
        return h('div', { class: 'day-block' }, mode === 'hafta' ? h('h3', { class: 'sec' }, dayName(d)) : null, table(rows, [
          { label: 'Saat', get: (a) => h('b', { class: 'time' }, a.time) },
          { label: 'Araç', get: (a) => { const v = vMap[a.vehicleId]; return v ? h('div', null, h('span', { class: 'plate' }, v.plate), h('div', { class: 'muted small' }, `${v.make} ${v.model}`)) : '—'; } },
          { label: 'Müşteri', get: (a) => { const c = cMap[a.customerId] || {}; return h('div', null, c.name || '—', h('div', { class: 'muted small' }, c.phone || '')); } },
          { label: 'İşlem', get: (a) => a.note || '—' },
          { label: 'Durum', get: (a) => { const s = C.APPT_STATUS[a.status] || C.APPT_STATUS.bekliyor; return badge(s.label, s.kind); } },
          { label: '', class: 'right nowrap', get: (a) => {
            const c = cMap[a.customerId] || {}, v = vMap[a.vehicleId] || {};
            const msg = `Merhaba ${c.name || ''}, ${v.plate || ''} plakalı aracınız için ${dayName(a.date)} saat ${a.time} randevunuzu hatırlatırız. ${SP.session.tenant.name}`;
            return [
              c.phone ? h('a', { class: 'btn sm ghost', href: SP.waLink(c.phone, msg), target: '_blank', rel: 'noopener' }, 'WhatsApp') : null,
              a.workOrderId ? h('a', { class: 'btn sm ghost', href: '#is-emri--' + a.workOrderId }, 'İş emri') : h('button', { class: 'btn sm primary', onclick: () => SP.newWorkOrder({ vehicleId: a.vehicleId, appointmentId: a.id, complaint: a.note }) }, 'Araç geldi'),
              h('select', { class: 'mini', 'aria-label': 'Durum', onchange: async (e) => { await C.update('appointments', a.id, { status: e.target.value }); reload(); } },
                Object.entries(C.APPT_STATUS).map(([k, s]) => h('option', { value: k, selected: k === a.status }, s.label))),
            ];
          } },
        ], { empty: 'Bu gün için randevu yok.', onRow: (a) => editAppt(a, reload) }));
      }).filter(Boolean));
      if (!box.children.length) box.append(h('div', { class: 'empty' }, 'Bu hafta randevu yok.'));
    };
    const step = (n) => { day = addD(day, mode === 'gun' ? n : n * 7); draw(); };
    view.append(pageHead('Randevular', null, h('button', { class: 'btn primary', onclick: () => editAppt(null, reload, day) }, '+ Yeni randevu')),
      h('div', { class: 'toolbar' },
        h('div', { class: 'row gap' }, h('button', { class: 'btn sm ghost', onclick: () => step(-1), 'aria-label': 'Önceki' }, '‹'), h('button', { class: 'btn sm ghost', onclick: () => { day = SP.ui.today(); draw(); } }, 'Bugün'), h('button', { class: 'btn sm ghost', onclick: () => step(1), 'aria-label': 'Sonraki' }, '›'), label),
        h('div', { class: 'tabs' }, [['gun', 'Gün'], ['hafta', 'Hafta']].map(([k, l]) => h('button', { class: 'tab' + (mode === k ? ' on' : ''), onclick: (e) => { mode = k; e.target.parentNode.querySelectorAll('.tab').forEach((b) => b.classList.toggle('on', b === e.target)); draw(); } }, l)))),
      box);
    draw();
  };
  SP.editAppt = editAppt;
})();
