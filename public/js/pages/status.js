/* Müşteriye açık araç durum sayfası: #durum--TOKEN (giriş gerektirmez, 30 sn'de bir yenilenir) */
(function () {
  const SP = window.SP;
  const { h, money, dateTime } = SP.ui;

  const STEPS = [
    ['acik', 'Araç kabul edildi', 'Aracınız servisimize alındı.'],
    ['islemde', 'İşlemde', 'Ustalarımız aracınız üzerinde çalışıyor.'],
    ['parca', 'Parça bekleniyor', 'Gerekli parçanın gelmesi bekleniyor.'],
    ['hazir', 'Teslime hazır', 'Aracınız hazır, teslim alabilirsiniz.'],
    ['teslim', 'Teslim edildi', 'Aracınız teslim edildi. İyi yolculuklar!'],
  ];

  SP.pages.durum = async (root, r) => {
    document.title = 'Araç durumu';
    const box = h('div', { class: 'st-wrap' }, h('div', { class: 'loading' }, 'Yükleniyor…'));
    root.append(box);
    let timer = null;

    async function load() {
      let d = null;
      try { d = await SP.api.getPublicStatus(r.id); } catch (e) { /* ağ hatası: bir sonraki denemede */ }
      if (!d) { box.replaceChildren(h('div', { class: 'st-card' }, h('h1', null, 'Bağlantı bulunamadı'), h('p', { class: 'muted' }, 'Bu bağlantı geçersiz veya süresi dolmuş olabilir. Lütfen servisinizle iletişime geçin.'))); return; }
      document.title = `${d.plate} — ${d.shop}`;
      const when = {}; (d.log || []).forEach((x) => { when[x.s] = x.at; });
      when.acik = when.acik || d.createdAt;
      const cur = d.status;
      const steps = STEPS.filter(([k]) => k !== 'parca' || cur === 'parca' || when.parca);
      const curIdx = steps.findIndex(([k]) => k === cur);
      const curStep = STEPS.find(([k]) => k === cur);
      const tel = String(d.shopPhone || '').replace(/[^\d+]/g, '');
      box.replaceChildren(h('div', { class: 'st-card' },
        h('div', { class: 'st-shop' }, d.logo ? h('img', { src: d.logo, alt: '' }) : h('span', { class: 'logo' }, (d.shop || 'S').slice(0, 1).toUpperCase()), h('div', null, h('b', null, d.shop), h('small', null, 'Servis durumu'))),
        h('div', { class: 'st-plate' }, h('span', { class: 'plate lg' }, d.plate), h('span', { class: 'muted' }, d.vehicle)),
        cur === 'iptal' ? h('div', { class: 'banner err' }, 'Bu iş emri iptal edildi. Ayrıntı için servisinizi arayın.') :
          h('div', { class: 'st-now ' + cur }, h('small', null, 'Şu anki durum'), h('h1', null, curStep ? curStep[1] : cur), h('p', null, curStep ? curStep[2] : '')),
        cur !== 'iptal' ? h('ol', { class: 'st-steps' }, steps.map(([k, label], i) => h('li', { class: i < curIdx ? 'done' : i === curIdx ? 'now' : '' },
          h('span', { class: 'dot' }, i < curIdx ? '✓' : ''), h('div', null, h('b', null, label), when[k] ? h('small', null, dateTime(when[k])) : null)))) : null,
        d.promised && !['hazir', 'teslim'].includes(cur) ? h('p', { class: 'st-meta' }, 'Tahmini teslim: ', h('b', null, dateTime(d.promised))) : null,
        d.total != null && cur === 'hazir' ? h('p', { class: 'st-meta' }, 'Ödenecek tutar (KDV dahil): ', h('b', null, money(d.total))) : null,
        h('div', { class: 'st-actions' },
          tel ? h('a', { class: 'btn primary block', href: 'tel:' + tel }, 'Servisi ara · ' + d.shopPhone) : null,
          tel && SP.waLink ? h('a', { class: 'btn ghost block', href: SP.waLink(tel, `Merhaba, ${d.plate} plakalı aracım hakkında bilgi almak istiyorum.`), target: '_blank', rel: 'noopener' }, 'WhatsApp’tan yaz') : null),
        d.shopAddress ? h('p', { class: 'muted small center' }, d.shopAddress) : null,
        h('p', { class: 'muted small center' }, 'Son güncelleme: ', dateTime(d.updatedAt), ' · Sayfa kendini yeniler.')),
      h('p', { class: 'st-powered' }, h('a', { href: '#' }, SP.config.appName), ' ile hazırlandı'));
    }
    await load();
    timer = setInterval(() => { if (!location.hash.startsWith('#durum')) { clearInterval(timer); return; } load(); }, 30000);
  };
})();
