/* Küçük arayüz yardımcıları — çerçevesiz (framework yok) */
(function () {
  const SP = window.SP;

  // DOM oluşturucu: h('div', {class:'x', onclick:fn}, 'metin', childNode, [dizi])
  function h(tag, props, ...children) {
    const el = document.createElement(tag);
    if (props) {
      for (const [k, v] of Object.entries(props)) {
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'style' && typeof v === 'object') { for (const [sk, sv] of Object.entries(v)) { if (sk.startsWith('--')) el.style.setProperty(sk, sv); else el.style[sk] = sv; } }
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (k === 'html') el.innerHTML = v;
        else if (k === 'value') el.value = v;
        else if (v === true) el.setAttribute(k, '');
        else el.setAttribute(k, v);
      }
    }
    append(el, children);
    return el;
  }
  function append(el, children) {
    for (const c of children.flat(Infinity)) {
      if (c == null || c === false) continue;
      el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
    }
  }

  const money = (n) => (Number(n) || 0).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 2 });
  const num = (n) => (Number(n) || 0).toLocaleString('tr-TR');
  const pad = (n) => String(n).padStart(2, '0');
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const toDate = (v) => (v ? (v.toDate ? v.toDate() : new Date(v)) : null);
  const date = (v) => { const d = toDate(v); return d && !isNaN(d) ? d.toLocaleDateString('tr-TR') : '—'; };
  const dateTime = (v) => { const d = toDate(v); return d && !isNaN(d) ? d.toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }) : '—'; };
  const norm = (s) => String(s || '').toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ').trim();
  const plate = (s) => String(s || '').toLocaleUpperCase('tr-TR').replace(/\s+/g, ' ').trim();

  function toast(msg, type = 'ok') {
    let box = document.getElementById('toasts');
    if (!box) { box = h('div', { id: 'toasts' }); document.body.appendChild(box); }
    const t = h('div', { class: 'toast ' + type }, msg);
    box.appendChild(t);
    setTimeout(() => t.classList.add('out'), 2600);
    setTimeout(() => t.remove(), 3000);
  }

  function modal(title, body, { wide = false, actions = [] } = {}) {
    const close = () => { wrap.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    const wrap = h('div', { class: 'modal-bg', onmousedown: (e) => { if (e.target === wrap) close(); } },
      h('div', { class: 'modal' + (wide ? ' wide' : ''), role: 'dialog', 'aria-label': title },
        h('div', { class: 'modal-head' }, h('h3', null, title), h('button', { class: 'icon-btn', onclick: close, 'aria-label': 'Kapat' }, '✕')),
        h('div', { class: 'modal-body' }, body),
        actions.length ? h('div', { class: 'modal-foot' }, actions) : null));
    document.body.appendChild(wrap);
    document.addEventListener('keydown', onKey);
    const first = wrap.querySelector('input,select,textarea');
    if (first) setTimeout(() => first.focus(), 30);
    return { close, el: wrap };
  }

  function confirmBox(msg, okText = 'Evet, sil') {
    return new Promise((res) => {
      const m = modal('Onay', h('p', null, msg), {
        actions: [
          h('button', { class: 'btn ghost', onclick: () => { m.close(); res(false); } }, 'Vazgeç'),
          h('button', { class: 'btn danger', onclick: () => { m.close(); res(true); } }, okText),
        ],
      });
    });
  }

  /* Form alanı tanımı: {name, label, type:'text|number|date|time|select|textarea|email|tel', options:[[v,l]], required, span:2, placeholder, step} */
  function field(f, value) {
    let input;
    const common = { name: f.name, id: 'f_' + f.name, required: f.required, placeholder: f.placeholder || '' };
    if (f.type === 'select') {
      const opts = typeof f.options === 'function' ? f.options() : f.options || [];
      input = h('select', common, opts.map(([v, l]) => h('option', { value: v, selected: String(v) === String(value ?? '') }, l)));
    } else if (f.type === 'textarea') {
      input = h('textarea', { ...common, rows: f.rows || 3 });
      input.value = value ?? '';
    } else {
      input = h('input', { ...common, type: f.type || 'text', step: f.step, min: f.min, list: f.list, autocomplete: f.autocomplete || 'off' });
      input.value = value ?? (f.default ?? '');
    }
    if (f.onchange) input.addEventListener('change', f.onchange);
    return h('label', { class: 'field' + (f.span === 2 ? ' span2' : '') }, h('span', null, f.label + (f.required ? ' *' : '')), input, f.hint ? h('small', null, f.hint) : null);
  }

  function readForm(form, fields) {
    const out = {};
    for (const f of fields) {
      const el = form.querySelector(`[name="${f.name}"]`);
      if (!el) continue;
      let v = el.value;
      if (f.type === 'number') v = v === '' ? null : Number(v);
      else v = v.trim();
      if (f.transform) v = f.transform(v);
      out[f.name] = v;
    }
    return out;
  }

  // Kayıt formu modalı — onSave(data) Promise döndürür
  function formModal(title, fields, initial, onSave, { saveText = 'Kaydet', wide = false, extra = null } = {}) {
    const form = h('form', { class: 'grid-form', onsubmit: async (e) => {
      e.preventDefault();
      const btn = form.querySelector('button[type=submit]') || saveBtn;
      saveBtn.disabled = true;
      try { await onSave(readForm(form, fields)); m.close(); }
      catch (err) { toast(err.message || String(err), 'err'); }
      finally { saveBtn.disabled = false; }
    } }, fields.map((f) => field(f, initial ? initial[f.name] : undefined)), extra);
    const saveBtn = h('button', { class: 'btn primary', onclick: () => form.requestSubmit() }, saveText);
    const m = modal(title, form, { wide, actions: [h('button', { class: 'btn ghost', onclick: () => m.close() }, 'Vazgeç'), saveBtn] });
    return m;
  }

  /* Basit tablo: columns [{label, get:(row)=>value|Node, class}] */
  function table(rows, columns, { empty = 'Kayıt yok', onRow } = {}) {
    if (!rows.length) return h('div', { class: 'empty' }, empty);
    return h('div', { class: 'table-wrap' }, h('table', null,
      h('thead', null, h('tr', null, columns.map((c) => h('th', { class: c.class }, c.label)))),
      h('tbody', null, rows.map((r) => h('tr', { class: onRow ? 'clickable' : null, onclick: onRow ? (e) => { if (!e.target.closest('button,a,input,select')) onRow(r); } : null },
        columns.map((c) => h('td', { class: c.class, 'data-label': c.label }, c.get(r))))))));
  }

  function badge(text, kind = '') { return h('span', { class: 'badge ' + kind }, text); }

  function searchBox(placeholder, oninput) {
    return h('input', { class: 'search', type: 'search', placeholder, oninput: (e) => oninput(norm(e.target.value)) });
  }

  function pageHead(title, sub, ...actions) {
    return h('div', { class: 'page-head' }, h('div', null, h('h1', null, title), sub ? h('p', { class: 'muted' }, sub) : null), h('div', { class: 'actions' }, actions));
  }

  SP.ui = { h, append, money, num, today, date, dateTime, toDate, norm, plate, toast, modal, confirmBox, field, readForm, formModal, table, badge, searchBox, pageHead, pad };
})();
