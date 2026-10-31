/* Excel / CSV'den içe aktarma: müşteri & araç listesi, stok kartları.
 * Excel'den satırları kopyalayıp yapıştırma (sekmeyle ayrılmış) veya .csv dosyası (; veya , ayraçlı) desteklenir.
 */
(function () {
  const SP = window.SP;
  const { h, toast, money, num, table, badge, pageHead, norm, plate } = SP.ui;
  const C = SP.core;

  // Türkçe sayı: "1.150,50" → 1150.5, "1150.5" → 1150.5
  const trNum = (v) => {
    let s = String(v ?? '').replace(/[^\d,.\-]/g, '');
    if (!s) return null;
    if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
    else if (s.includes(',')) s = s.replace(',', '.');
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    const n = Number(s); return Number.isFinite(n) ? n : null;
  };
  const digits = (v) => String(v || '').replace(/\D/g, '').replace(/^90(?=5\d{9}$)/, '').replace(/^0/, '');

  // CSV / TSV ayrıştırıcı (tırnaklı alanları destekler)
  function parse(text) {
    text = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n').trim();
    if (!text) return [];
    const first = text.split('\n')[0];
    const delim = first.includes('\t') ? '\t' : (first.split(';').length >= first.split(',').length ? ';' : ',');
    const rows = []; let row = [], cur = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
      else if (c === '"' && cur === '') q = true;
      else if (c === delim) { row.push(cur.trim()); cur = ''; }
      else if (c === '\n') { row.push(cur.trim()); rows.push(row); row = []; cur = ''; }
      else cur += c;
    }
    row.push(cur.trim()); rows.push(row);
    return rows.filter((r) => r.some((x) => x !== ''));
  }

  const KINDS = {
    musteri: {
      label: 'Müşteri & araç listesi',
      cols: {
        name: ['ad soyad', 'adsoyad', 'müşteri', 'musteri', 'müşteri adı', 'ad', 'isim', 'firma', 'ünvan', 'unvan', 'cari', 'cari adı'],
        phone: ['telefon', 'tel', 'gsm', 'cep', 'cep telefonu', 'telefon no'],
        email: ['e-posta', 'eposta', 'email', 'e-mail', 'mail'],
        plate: ['plaka', 'plaka no'],
        make: ['marka'], model: ['model'], year: ['yıl', 'yil', 'model yılı', 'model yili'],
        engine: ['motor', 'motor tipi'], vin: ['şasi', 'sasi', 'şasi no', 'sasi no', 'vin'], km: ['km', 'kilometre'],
        taxNo: ['vergi no', 'vkn', 'tc', 'tckn', 'tc no', 'vergi/tc'], taxOffice: ['vergi dairesi', 'vd'],
        address: ['adres'], city: ['il', 'şehir', 'sehir', 'il/ilçe'], note: ['not', 'açıklama', 'aciklama'],
      },
      required: ['name'],
      sample: 'Ad Soyad\tTelefon\tPlaka\tMarka\tModel\tYıl\tMotor\tKm\nMehmet Yılmaz\t0532 111 22 33\t34 ABC 123\tPeugeot\t301\t2018\t1.6 HDi\t128400\nKaradeniz Lojistik\t0362 444 55 66\t55 KL 4410\tFiat\tDoblo\t2020\t1.6 Multijet\t210300',
    },
    stok: {
      label: 'Stok kartları',
      cols: {
        code: ['stok kodu', 'kod', 'ürün kodu', 'urun kodu', 'parça kodu', 'parca kodu'],
        name: ['parça adı', 'parca adi', 'ürün adı', 'urun adi', 'ad', 'adı', 'açıklama', 'aciklama', 'parça', 'parca', 'ürün', 'urun'],
        brand: ['marka'], oem: ['oem', 'oem no', 'üretici no', 'uretici no', 'orijinal no'],
        unit: ['birim'], shelf: ['raf', 'konum', 'raf/konum'],
        buy: ['alış', 'alis', 'alış fiyatı', 'alis fiyati', 'maliyet'], sell: ['satış', 'satis', 'satış fiyatı', 'satis fiyati', 'fiyat'],
        vat: ['kdv', 'kdv %', 'kdv oranı'], stock: ['stok', 'miktar', 'adet', 'mevcut'], minStock: ['kritik', 'kritik stok', 'min stok', 'minimum'],
      },
      required: ['code', 'name'],
      sample: 'Stok Kodu\tParça Adı\tMarka\tOEM\tAlış\tSatış\tStok\tKritik\tRaf\nER-YF-1601\tYağ Filtresi\tEurorepar\t1109.CK\t120\t210\t14\t5\tA-1\nER-BK-221\tÖn Fren Balatası\tEurorepar\t1617253880\t650\t1150\t6\t2\tB-4',
    },
  };

  function mapHeader(kind, header) {
    const cols = KINDS[kind].cols, map = {};
    header.forEach((hd, i) => {
      const k = norm(hd).replace(/[:*]/g, '').trim();
      for (const [field, aliases] of Object.entries(cols)) if (!(field in map) && aliases.includes(k)) { map[field] = i; break; }
    });
    return map;
  }

  SP.pages['ice-aktar'] = async (view, r) => {
    let kind = r.query.tur === 'stok' ? 'stok' : 'musteri';
    const ta = h('textarea', { id: 'imp_text', rows: 8, placeholder: 'Excel’de satırları başlıklarıyla birlikte seçip kopyalayın (Ctrl+C), buraya yapıştırın (Ctrl+V).' });
    const file = h('input', { type: 'file', id: 'imp_file', accept: '.csv,.txt,text/csv' });
    const tabs = h('div', { class: 'tabs' });
    const help = h('div', { class: 'muted small' });
    const preview = h('div');
    const go = h('button', { class: 'btn primary', disabled: true }, 'İçe aktar');
    let plan = null;

    const drawTabs = () => {
      tabs.replaceChildren(...Object.entries(KINDS).map(([k, v]) => h('button', { class: 'tab' + (k === kind ? ' on' : ''), onclick: () => { kind = k; drawTabs(); analyze(); } }, v.label)));
      const cols = Object.values(KINDS[kind].cols).map((a) => a[0]);
      help.replaceChildren('Tanınan sütun başlıkları: ', cols.join(', '), '. ', h('b', null, 'Zorunlu: ' + KINDS[kind].required.map((f) => KINDS[kind].cols[f][0]).join(', ')), '.');
    };

    async function analyze() {
      plan = null; go.disabled = true;
      const rows = parse(ta.value);
      if (rows.length < 2) { preview.replaceChildren(rows.length ? h('div', { class: 'empty' }, 'En az bir başlık satırı ve bir veri satırı gerekli.') : ''); return; }
      const map = mapHeader(kind, rows[0]);
      const missing = KINDS[kind].required.filter((f) => !(f in map));
      if (missing.length) { preview.replaceChildren(h('div', { class: 'empty err' }, 'Şu sütun(lar) bulunamadı: ' + missing.map((f) => KINDS[kind].cols[f][0]).join(', ') + '. İlk satırın başlık olduğundan emin olun.')); return; }
      const get = (row, f) => (f in map ? (row[map[f]] ?? '').trim() : '');
      const data = rows.slice(1);
      plan = kind === 'musteri' ? await planCustomers(data, get) : await planParts(data, get);
      const ignored = rows[0].filter((_, i) => !Object.values(map).includes(i));
      preview.replaceChildren(
        h('div', { class: 'kpis' }, ...plan.summary.map(([l, v, k]) => SP.kpi(l, v, null, k))),
        ignored.length ? h('p', { class: 'muted small' }, 'Kullanılmayacak sütunlar: ' + ignored.join(', ')) : null,
        plan.errors.length ? h('div', { class: 'banner err' }, plan.errors.slice(0, 5).join(' · ') + (plan.errors.length > 5 ? ` (+${plan.errors.length - 5})` : '')) : null,
        h('h2', { class: 'sec' }, 'Önizleme (ilk 20 satır)'), plan.preview);
      go.disabled = !plan.count;
      go.textContent = plan.count ? `${plan.count} kaydı içe aktar` : 'Aktarılacak yeni kayıt yok';
    }

    async function planCustomers(data, get) {
      const [cs, vs] = await Promise.all([C.all('customers', true), C.all('vehicles', true)]);
      const byPhone = new Map(cs.filter((c) => c.phone).map((c) => [digits(c.phone), c]));
      const byName = new Map(cs.map((c) => [norm(c.name), c]));
      const plates = new Set(vs.map((v) => plate(v.plate).replace(/\s/g, '')));
      const groups = new Map(); const errors = []; let skipPlates = 0;
      data.forEach((row, i) => {
        const name = get(row, 'name'); if (!name) { errors.push(`Satır ${i + 2}: ad boş`); return; }
        const ph = get(row, 'phone'); const key = digits(ph) || norm(name);
        if (!groups.has(key)) groups.set(key, { c: {
          type: /ltd|a\.ş|aş\b|şti|san\.|tic\.|lojistik|inşaat|ticaret/i.test(name) || get(row, 'taxNo').length === 10 ? 'kurumsal' : 'bireysel',
          name, phone: ph, email: get(row, 'email'), taxNo: get(row, 'taxNo'), taxOffice: get(row, 'taxOffice'), address: get(row, 'address'), city: get(row, 'city'), note: get(row, 'note') },
          existing: byPhone.get(digits(ph)) || byName.get(norm(name)) || null, vehicles: [] });
        const pl = plate(get(row, 'plate'));
        if (pl) {
          const k = pl.replace(/\s/g, '');
          if (plates.has(k)) { skipPlates++; return; }
          plates.add(k);
          groups.get(key).vehicles.push({ plate: pl, make: get(row, 'make'), model: get(row, 'model'), year: trNum(get(row, 'year')), engine: get(row, 'engine'), vin: get(row, 'vin').toUpperCase(), km: trNum(get(row, 'km')) });
        }
      });
      const list = [...groups.values()];
      const newC = list.filter((g) => !g.existing).length, newV = list.reduce((s, g) => s + g.vehicles.length, 0);
      return {
        kind: 'musteri', list, errors, count: newC + newV,
        summary: [['Yeni müşteri', newC], ['Mevcut müşteri', list.length - newC], ['Yeni araç', newV], ['Atlanan (kayıtlı plaka)', skipPlates, skipPlates ? 'neg' : '']],
        preview: table(list.slice(0, 20), [
          { label: 'Müşteri', get: (g) => h('div', null, h('b', null, g.c.name), g.existing ? badge('Kayıtlı', 'info') : badge('Yeni', 'ok')) },
          { label: 'Telefon', get: (g) => g.c.phone || '—' },
          { label: 'Araçlar', get: (g) => g.vehicles.length ? g.vehicles.map((v) => h('span', { class: 'plate' }, v.plate)) : '—' },
          { label: 'Bilgi', get: (g) => g.vehicles.map((v) => [v.make, v.model, v.year].filter(Boolean).join(' ')).join(' / ') || '—' },
        ]),
      };
    }

    async function planParts(data, get) {
      const parts = await C.all('parts', true);
      const codes = new Set(parts.map((p) => norm(p.code)));
      const errors = []; const list = []; let skip = 0;
      data.forEach((row, i) => {
        const code = get(row, 'code'), name = get(row, 'name');
        if (!code || !name) { errors.push(`Satır ${i + 2}: kod veya ad boş`); return; }
        if (codes.has(norm(code))) { skip++; return; }
        codes.add(norm(code));
        const sell = trNum(get(row, 'sell')), buy = trNum(get(row, 'buy'));
        list.push({ code, name, brand: get(row, 'brand'), oem: get(row, 'oem'), unit: get(row, 'unit') || 'adet', shelf: get(row, 'shelf'),
          buy: buy ?? 0, sell: sell ?? 0, vat: trNum(get(row, 'vat')) ?? SP.VAT_DEFAULT, stock: trNum(get(row, 'stock')) ?? 0, minStock: trNum(get(row, 'minStock')) ?? 0, compat: [] });
        if (sell == null) errors.push(`Satır ${i + 2}: satış fiyatı yok, 0 olarak eklenecek`);
      });
      const max = C.limits().parts;
      let count = list.length;
      if (max != null && parts.length + count > max) { errors.unshift(`Paket sınırı: en fazla ${max} stok kartı. ${Math.max(0, max - parts.length)} kart aktarılabilir.`); count = Math.max(0, max - parts.length); list.length = count; }
      return {
        kind: 'stok', list, errors, count,
        summary: [['Yeni stok kartı', count], ['Atlanan (kayıtlı kod)', skip, skip ? 'neg' : ''], ['Toplam stok değeri', money(list.reduce((s, p) => s + p.stock * p.buy, 0))]],
        preview: table(list.slice(0, 20), [
          { label: 'Kod', get: (p) => h('b', null, p.code) }, { label: 'Parça', get: (p) => p.name + (p.brand ? ' · ' + p.brand : '') },
          { label: 'Alış', class: 'right', get: (p) => money(p.buy) }, { label: 'Satış', class: 'right', get: (p) => money(p.sell) },
          { label: 'Stok', class: 'right', get: (p) => num(p.stock) + ' ' + p.unit },
        ]),
      };
    }

    go.addEventListener('click', async () => {
      if (!plan || !C.guardWrite()) return;
      go.disabled = true;
      const bar = h('i'); const lbl = h('span', null, '');
      preview.prepend(h('div', { class: 'usage' }, lbl, h('div', { class: 'bar' }, bar)));
      let done = 0; const total = plan.count;
      const tick = () => { done++; bar.style.width = (done / total * 100) + '%'; lbl.textContent = `${done} / ${total}`; };
      try {
        if (plan.kind === 'musteri') {
          for (const g of plan.list) {
            let cid = g.existing && g.existing.id;
            if (!cid) { cid = await SP.api.add('customers', g.c); tick(); }
            for (const v of g.vehicles) { await SP.api.add('vehicles', { ...v, customerId: cid }); tick(); }
          }
          C.invalidate('customers', 'vehicles');
        } else {
          for (const p of plan.list) {
            const id = await SP.api.add('parts', p);
            if (p.stock) await SP.api.add('stockMoves', { partId: id, qty: p.stock, type: 'giris', note: 'Açılış stoku (içe aktarma)', date: SP.ui.today() });
            tick();
          }
          C.invalidate('parts', 'stockMoves');
        }
        toast(`${done} kayıt içe aktarıldı`);
        SP.go(plan.kind === 'musteri' ? 'musteriler' : 'stok');
      } catch (e) { toast(`${done} kayıttan sonra durdu: ${e.message}`, 'err'); go.disabled = false; }
    });

    ta.addEventListener('input', () => { clearTimeout(ta._t); ta._t = setTimeout(analyze, 250); });
    file.addEventListener('change', async () => {
      const f = file.files[0]; if (!f) return;
      const buf = await f.arrayBuffer();
      let text = new TextDecoder('utf-8').decode(buf);
      if (text.includes('�')) text = new TextDecoder('windows-1254').decode(buf); // Türkçe Excel CSV
      ta.value = text; analyze();
    });
    const copySample = () => {
      const s = KINDS[kind].sample;
      (navigator.clipboard ? navigator.clipboard.writeText(s) : Promise.reject()).then(() => toast('Örnek tablo kopyalandı. Excel’de boş bir sayfaya yapıştırın.'), () => { ta.value = s; analyze(); });
    };

    drawTabs();
    view.append(
      pageHead('Verileri içe aktar', 'Eski programınızdaki veya Excel’deki listelerinizi tek seferde aktarın.'),
      h('div', { class: 'toolbar' }, tabs, h('button', { class: 'btn sm ghost', onclick: copySample }, 'Örnek tabloyu kopyala')),
      h('div', { class: 'card stack' },
        h('label', { class: 'field' }, h('span', null, '1. Excel’den yapıştırın'), ta),
        h('label', { class: 'field' }, h('span', null, 'veya 2. CSV dosyası seçin'), file),
        help),
      preview,
      h('div', { class: 'row between', style: { marginTop: '16px' } }, h('span', { class: 'muted small' }, 'Kayıtlı plakalar ve stok kodları atlanır; aynı dosyayı iki kez aktarmak mükerrer kayıt oluşturmaz.'), go));
  };
})();
