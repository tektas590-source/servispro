/* Herkese açık sayfalar: tanıtım (satış) sayfası, giriş, kayıt, şifre sıfırlama */
(function () {
  const SP = window.SP;
  const { h, toast, money } = SP.ui;

  function pricingCards(cta) {
    return h('div', { class: 'pricing' }, SP.PLAN_ORDER.map((k) => {
      const p = SP.PLANS[k];
      return h('div', { class: 'price-card' + (p.popular ? ' popular' : '') },
        p.popular ? h('span', { class: 'ribbon' }, 'En çok tercih edilen') : null,
        h('h3', null, p.name), h('p', { class: 'muted' }, p.tagline),
        h('div', { class: 'price' }, h('b', null, money(p.price).replace(',00', '')), h('span', null, ' / ay + KDV')),
        h('ul', null, p.features.map((f) => h('li', null, f))),
        cta(p));
    }));
  }
  SP.pricingCards = pricingCards;

  SP.pages.landing = async (root) => {
    const M = SP.motion;
    const manual = SP.config.paymentMode === 'manual';
    const demoBtn = SP.api.isDemo ? h('button', { class: 'btn ghost-light lg', onclick: () => SP.api.login('demo@servispro.com', 'demo123') }, 'Demoyu incele') : null;
    const toPrices = (e) => { e.preventDefault(); document.getElementById('fiyatlar').scrollIntoView({ behavior: M.reduce ? 'auto' : 'smooth' }); };
    const feats = [
      ['01', 'Müşteri & araç kartı', 'Plaka, şasi, motor, km ve tüm servis geçmişi tek ekranda. Plakayla saniyede bulun.'],
      ['02', 'İş emri & randevu', 'Araç kabulden teslime kadar her aşamayı takip edin: işlemde, parça bekliyor, hazır.'],
      ['03', 'Stok & parça', 'İş emri kapanınca stok otomatik düşer. Kritik stok uyarısıyla parçasız kalmayın.'],
      ['04', 'Parça–araç uyumluluğu', 'Araç seçildiğinde o araca uyan parçalar öne çıkar. Yanlış parça siparişine son.'],
      ['05', 'Fatura & tahsilat', 'İş emrinden tek tıkla fatura veya teklif; nakit, kart, havale tahsilatı ve cari takip.'],
      ['06', 'Ekip & yetki', 'Ustalarınızı davet edin, herkes kendi hesabıyla girsin. Bilgisayar, tablet, telefon.'],
    ];

    // Kahraman kartı: iş emri satır satır "kurulur"
    const totalEl = h('b', { class: 'hc-total' }, '2.592 ₺');
    const card = h('div', { class: 'hero-card', 'aria-hidden': 'true' },
      h('div', { class: 'hc-glare' }),
      h('div', { class: 'hc-row head seq', style: { '--d': '900ms' } }, h('b', null, 'İş emri IE-0142'), h('span', { class: 'badge warn pulse-badge' }, 'İşlemde')),
      h('div', { class: 'hc-plate stamp', style: { '--d': '1150ms' } }, '55 ABC 123'),
      h('div', { class: 'hc-row seq', style: { '--d': '1350ms' } }, h('span', null, 'Peugeot 301 · 1.6 HDi · 2018'), h('span', { class: 'mono' }, '128.400 km')),
      h('div', { class: 'hc-line seq', style: { '--d': '1600ms' } }, h('span', null, 'Ön Fren Balatası'), h('span', { class: 'badge ok pop', style: { '--d': '1900ms' } }, '✓ Uyumlu'), h('b', null, '1.150 ₺')),
      h('div', { class: 'hc-line seq', style: { '--d': '1800ms' } }, h('span', null, 'Yağ Filtresi'), h('span', { class: 'badge ok pop', style: { '--d': '2100ms' } }, '✓ Uyumlu'), h('b', null, '210 ₺')),
      h('div', { class: 'hc-line seq', style: { '--d': '2000ms' } }, h('span', null, 'Bakım işçiliği'), h('span', null, ''), h('b', null, '800 ₺')),
      h('div', { class: 'hc-row total seq', style: { '--d': '2250ms' } }, h('span', null, 'Toplam (KDV dahil)'), totalEl));

    const title = h('h1', { class: 'hero-title' }, 'Servisinizi defterden kurtarın.');
    const nav = h('header', { class: 'l-nav' },
      h('div', { class: 'l-nav-in' },
        h('div', { class: 'brand' }, h('span', { class: 'logo' }, 'S'), h('b', null, SP.config.appName)),
        h('nav', null, h('a', { href: '#', onclick: toPrices }, 'Fiyatlar'), h('a', { href: '#giris' }, 'Giriş'), h('a', { href: '#kayit', class: 'btn primary sm' }, 'Ücretsiz dene'))));

    const stat = (n, opts, label) => { const b = h('b', null, ''); M.countOnView(b, n, opts); return h('div', { class: 'stat rv' }, b, h('span', null, label)); };

    root.append(h('div', { class: 'landing' },
      nav,
      h('section', { class: 'hero-band' },
        h('div', { class: 'hb-fx', 'aria-hidden': 'true' }, h('div', { class: 'hb-grid' }), h('div', { class: 'hb-beam b1' }), h('div', { class: 'hb-beam b2' }), h('div', { class: 'hb-glow' })),
        h('div', { class: 'hero' },
          h('div', { class: 'hero-copy' },
            h('span', { class: 'eyebrow fade-up', style: { '--d': '100ms' } }, 'Oto servisler için bulut yazılım'),
            M.splitWords(title, 200, 90),
            h('p', { class: 'lead fade-up', style: { '--d': '750ms' } }, 'Randevu, iş emri, stok, parça uyumluluğu, fatura ve tahsilat — hepsi tek yerde. Kurulum yok, tarayıcıdan açın ve çalışmaya başlayın.'),
            h('div', { class: 'hero-cta fade-up', style: { '--d': '950ms' } }, h('a', { href: '#kayit', class: 'btn primary lg shine' }, `${SP.config.trialDays} gün ücretsiz dene`), demoBtn),
            h('p', { class: 'hero-note fade-up', style: { '--d': '1100ms' } }, 'Kredi kartı gerekmez · Taahhüt yok')),
          h('div', { class: 'hero-stage' }, card)),
        h('div', { class: 'scroll-cue', 'aria-hidden': 'true' }, h('span', null))),
      h('section', { class: 'stats' },
        stat(SP.config.trialDays, { suffix: ' gün' }, 'ücretsiz deneme'),
        stat(1, { suffix: ' dk' }, 'kayıt süresi'),
        stat(6, {}, 'modül tek panelde'),
        stat(0, { suffix: ' ₺' }, 'kurulum ücreti')),
      h('section', { class: 'features' },
        h('div', { class: 'sec-head rv' }, h('span', { class: 'kicker' }, 'Modüller'), h('h2', null, 'Bir serviste ne lazımsa')),
        h('div', { class: 'feat-grid' }, feats.map(([n, t, d], i) => h('div', { class: 'feat rv', style: { '--i': i } }, h('span', { class: 'feat-no' }, n), h('h3', null, t), h('p', null, d))))),
      h('section', { class: 'how' },
        h('div', { class: 'sec-head rv' }, h('span', { class: 'kicker' }, 'Başlangıç'), h('h2', null, '3 adımda başlayın')),
        h('ol', { class: 'steps rv' },
          h('li', { style: { '--i': 0 } }, h('b', null, 'Hesap açın'), h('span', null, 'Servis adınız ve e-postanızla 1 dakikada kayıt olun.')),
          h('li', { style: { '--i': 1 } }, h('b', null, 'Kayıtlarınızı girin'), h('span', null, 'Müşteri, araç ve stok kartlarınızı ekleyin — eski sisteminizden aktarımda yardımcı oluyoruz.')),
          h('li', { style: { '--i': 2 } }, h('b', null, 'Paketinizi seçin'), h('span', null, manual ? 'Deneme bitince size uyan paketi seçin, aylık ücreti havale/EFT ile ödeyin.' : 'Deneme bitince size uyan paketle kartınızdan aylık ödeyin.')))),
      h('section', { class: 'pricing-sec', id: 'fiyatlar' },
        h('div', { class: 'sec-head rv' }, h('span', { class: 'kicker' }, 'Fiyatlar'), h('h2', null, 'Sade fiyatlar'),
          h('p', { class: 'muted center' }, manual ? 'Tüm paketlerde güncellemeler ve bulut yedekleme dahil. Ödeme aylık havale/EFT ile.' : 'Tüm paketlerde güncellemeler ve bulut yedekleme dahil. Ödemeler iyzico güvencesiyle.')),
        pricingCards((p) => h('a', { href: '#kayit?paket=' + p.id, class: 'btn ' + (p.popular ? 'primary' : 'ghost') + ' block' }, 'Ücretsiz başla'))),
      h('section', { class: 'faq' },
        h('div', { class: 'sec-head rv' }, h('span', { class: 'kicker' }, 'SSS'), h('h2', null, 'Sık sorulanlar')),
        [['Deneme süresinde hangi özellikler açık?', `${SP.config.trialDays} gün boyunca Profesyonel paketin tüm özelliklerini ücretsiz kullanırsınız.`],
          ['Aboneliği nasıl iptal ederim?', manual ? 'Taahhüt yok. Bir sonraki ayın ödemesini yapmazsanız abonelik kendiliğinden biter; kayıtlarınızı görmeye devam edersiniz.' : 'Abonelik sayfasından tek tıkla. Ödediğiniz dönemin sonuna kadar kullanmaya devam edersiniz.'],
          ['Verilerim güvende mi?', 'Veriler Google altyapısında şifreli saklanır, her servisin verisi diğerlerinden tamamen ayrıdır.'],
          ['e-Fatura kesebilir miyim?', 'Uygulama servis faturası ve teklif üretir. e-Fatura/e-Arşiv entegrasyonu yol haritamızda.']]
          .map(([q, a], i) => h('details', { class: 'rv', style: { '--i': i } }, h('summary', null, q), h('p', null, a)))),
      h('section', { class: 'final-cta rv' },
        h('h2', null, 'Defteri kapatmaya hazır mısınız?'),
        h('p', null, `${SP.config.trialDays} gün boyunca tüm özellikler ücretsiz. Sorunuz olursa arayın: ${SP.config.supportPhone}`),
        h('a', { href: '#kayit', class: 'btn primary lg shine' }, 'Hemen ücretsiz başla')),
      h('footer', { class: 'l-foot' }, h('span', null, `© ${new Date().getFullYear()} ${SP.config.appName}`), SP.legalLinks(), h('span', null, SP.config.supportEmail), h('span', null, SP.config.supportPhone))));

    // fiyat kartlarına sıralı belirme
    root.querySelectorAll('.price-card').forEach((c, i) => { c.classList.add('rv'); c.style.setProperty('--i', i); });
    M.stickyNav(nav);
    M.tilt(card, 8);
    M.countUp(totalEl, 2592, { suffix: ' ₺', delay: M.reduce ? 0 : 2300, dur: 1100 });
    requestAnimationFrame(() => M.reveal(root));
  };

  function authCard(title, sub, body, foot) {
    return h('div', { class: 'auth-wrap' }, h('div', { class: 'auth-card' },
      h('a', { href: '#', class: 'brand' }, h('span', { class: 'logo' }, 'S'), h('b', null, SP.config.appName)),
      h('h2', null, title), sub ? h('p', { class: 'muted' }, sub) : null, body, h('div', { class: 'auth-foot' }, foot)));
  }
  function submitter(form, fn) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = form.querySelector('button[type=submit]');
      btn.disabled = true; const t = btn.textContent; btn.textContent = 'Lütfen bekleyin…';
      try { await fn(Object.fromEntries(new FormData(form))); }
      catch (err) { toast(err.message || String(err), 'err'); }
      finally { btn.disabled = false; btn.textContent = t; }
    });
    return form;
  }

  SP.pages.giris = async (root) => {
    const form = submitter(h('form', { class: 'stack' },
      h('label', { class: 'field' }, h('span', null, 'E-posta'), h('input', { name: 'email', type: 'email', required: true, autocomplete: 'email' })),
      h('label', { class: 'field' }, h('span', null, 'Şifre'), h('input', { name: 'password', type: 'password', required: true, autocomplete: 'current-password' })),
      h('button', { class: 'btn primary block', type: 'submit' }, 'Giriş yap'),
      SP.api.isDemo ? h('p', { class: 'muted small center' }, 'Demo hesabı: demo@servispro.com / demo123') : null),
    (d) => SP.api.login(d.email, d.password));
    root.append(authCard('Giriş yapın', null, form, [h('a', { href: '#sifre' }, 'Şifremi unuttum'), h('span', null, 'Hesabınız yok mu? ', h('a', { href: '#kayit' }, 'Ücretsiz deneyin'))]));
  };

  SP.pages.kayit = async (root) => {
    const form = submitter(h('form', { class: 'stack' },
      h('label', { class: 'field' }, h('span', null, 'Servis / firma adı'), h('input', { name: 'company', required: true, placeholder: 'Örn. Yılmaz Oto Servis' })),
      h('label', { class: 'field' }, h('span', null, 'Adınız soyadınız'), h('input', { name: 'name', required: true, autocomplete: 'name' })),
      h('label', { class: 'field' }, h('span', null, 'Telefon'), h('input', { name: 'phone', type: 'tel', autocomplete: 'tel', placeholder: '05xx xxx xx xx' })),
      h('label', { class: 'field' }, h('span', null, 'E-posta'), h('input', { name: 'email', type: 'email', required: true, autocomplete: 'email' })),
      h('label', { class: 'field' }, h('span', null, 'Şifre (en az 6 karakter)'), h('input', { name: 'password', type: 'password', required: true, minlength: 6, autocomplete: 'new-password' })),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', required: true }), h('span', null, h('a', { href: '#sozlesme', target: '_blank' }, 'Abonelik sözleşmesini'), ' okudum ve kabul ediyorum; ', h('a', { href: '#kvkk', target: '_blank' }, 'KVKK aydınlatma metnini'), ' okudum.')),
      h('button', { class: 'btn primary block', type: 'submit' }, `${SP.config.trialDays} günlük denemeyi başlat`),
      h('p', { class: 'muted small center' }, 'Bir servisten davet aldıysanız aynı e-posta ile kayıt olun, o servise otomatik katılırsınız.')),
    async (d) => { await SP.api.register(d); toast('Hoş geldiniz! Deneme süreniz başladı.'); });
    root.append(authCard('Ücretsiz deneyin', `${SP.config.trialDays} gün boyunca tüm özellikler açık. Kart bilgisi gerekmez.`, form, h('span', null, 'Zaten hesabınız var mı? ', h('a', { href: '#giris' }, 'Giriş yapın'))));
  };

  SP.pages.sifre = async (root) => {
    const form = submitter(h('form', { class: 'stack' },
      h('label', { class: 'field' }, h('span', null, 'E-posta'), h('input', { name: 'email', type: 'email', required: true })),
      h('button', { class: 'btn primary block', type: 'submit' }, 'Sıfırlama bağlantısı gönder')),
    async (d) => { await SP.api.resetPassword(d.email); toast('E-posta adresinize sıfırlama bağlantısı gönderildi.'); SP.go('giris'); });
    root.append(authCard('Şifre sıfırlama', 'Kayıtlı e-posta adresinizi yazın.', form, h('a', { href: '#giris' }, 'Girişe dön')));
  };
})();
