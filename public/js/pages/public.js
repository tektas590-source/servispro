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
    const demoBtn = SP.api.isDemo ? h('button', { class: 'btn ghost lg', onclick: () => SP.api.login('demo@servispro.com', 'demo123') }, 'Demoyu incele') : null;
    const feats = [
      ['Müşteri & araç kartı', 'Plaka, şasi, motor, km ve tüm servis geçmişi tek ekranda. Plakayla saniyede bulun.'],
      ['İş emri & randevu', 'Araç kabulden teslime kadar her aşamayı takip edin: işlemde, parça bekliyor, hazır.'],
      ['Stok & parça', 'İş emri kapanınca stok otomatik düşer. Kritik stok uyarısıyla parçasız kalmayın.'],
      ['Parça–araç uyumluluğu', 'Araç seçildiğinde o araca uyan parçalar öne çıkar. Yanlış parça siparişine son.'],
      ['Fatura & tahsilat', 'İş emrinden tek tıkla fatura veya teklif; nakit, kart, havale tahsilatı ve cari takip.'],
      ['Ekip & yetki', 'Ustalarınızı davet edin, herkes kendi hesabıyla girsin. Bilgisayar, tablet, telefon.'],
    ];
    root.append(h('div', { class: 'landing' },
      h('header', { class: 'l-nav' }, h('div', { class: 'brand' }, h('span', { class: 'logo' }, 'S'), h('b', null, SP.config.appName)),
        h('nav', null, h('a', { href: '#', onclick: (e) => { e.preventDefault(); document.getElementById('fiyatlar').scrollIntoView({ behavior: 'smooth' }); } }, 'Fiyatlar'), h('a', { href: '#giris' }, 'Giriş'), h('a', { href: '#kayit', class: 'btn primary sm' }, 'Ücretsiz dene'))),
      h('section', { class: 'hero' },
        h('div', null,
          h('span', { class: 'eyebrow' }, 'Oto servisler için bulut yazılım'),
          h('h1', null, 'Servisinizi defterden kurtarın.'),
          h('p', { class: 'lead' }, 'Randevu, iş emri, stok, parça uyumluluğu, fatura ve tahsilat — hepsi tek yerde. Kurulum yok, tarayıcıdan açın ve çalışmaya başlayın.'),
          h('div', { class: 'hero-cta' }, h('a', { href: '#kayit', class: 'btn primary lg' }, `${SP.config.trialDays} gün ücretsiz dene`), demoBtn),
          h('p', { class: 'muted small' }, 'Kredi kartı gerekmez · İstediğiniz zaman iptal')),
        h('div', { class: 'hero-card', 'aria-hidden': 'true' },
          h('div', { class: 'hc-row head' }, h('b', null, 'İş emri IE-0142'), h('span', { class: 'badge warn' }, 'İşlemde')),
          h('div', { class: 'hc-plate' }, '55 ABC 123'),
          h('div', { class: 'hc-row' }, h('span', null, 'Peugeot 301 · 1.6 HDi · 2018'), h('span', null, '128.400 km')),
          h('div', { class: 'hc-line' }, h('span', null, 'Ön Fren Balatası'), h('span', { class: 'badge ok' }, 'Uyumlu'), h('b', null, '1.150 ₺')),
          h('div', { class: 'hc-line' }, h('span', null, 'Yağ Filtresi'), h('span', { class: 'badge ok' }, 'Uyumlu'), h('b', null, '210 ₺')),
          h('div', { class: 'hc-line' }, h('span', null, 'Bakım işçiliği'), h('span', null, ''), h('b', null, '800 ₺')),
          h('div', { class: 'hc-row total' }, h('span', null, 'Toplam (KDV dahil)'), h('b', null, '2.592 ₺')))),
      h('section', { class: 'features' }, h('h2', null, 'Bir serviste ne lazımsa'), h('div', { class: 'feat-grid' }, feats.map(([t, d]) => h('div', { class: 'feat' }, h('h3', null, t), h('p', null, d))))),
      h('section', { class: 'how' }, h('h2', null, '3 adımda başlayın'), h('ol', { class: 'steps' },
        h('li', null, h('b', null, 'Hesap açın'), h('span', null, 'Servis adınız ve e-postanızla 1 dakikada kayıt olun.')),
        h('li', null, h('b', null, 'Kayıtlarınızı girin'), h('span', null, 'Müşteri, araç ve stok kartlarınızı ekleyin — eski sisteminizden aktarımda yardımcı oluyoruz.')),
        h('li', null, h('b', null, 'Paketinizi seçin'), h('span', null, 'Deneme bitince size uyan paketle kartınızdan aylık ödeyin.')))),
      h('section', { class: 'pricing-sec', id: 'fiyatlar' }, h('h2', null, 'Sade fiyatlar'), h('p', { class: 'muted center' }, 'Tüm paketlerde güncellemeler ve bulut yedekleme dahil. Ödemeler iyzico güvencesiyle.'),
        pricingCards((p) => h('a', { href: '#kayit?paket=' + p.id, class: 'btn ' + (p.popular ? 'primary' : 'ghost') + ' block' }, 'Ücretsiz başla'))),
      h('section', { class: 'faq' }, h('h2', null, 'Sık sorulanlar'),
        [['Deneme süresinde hangi özellikler açık?', `${SP.config.trialDays} gün boyunca Profesyonel paketin tüm özelliklerini ücretsiz kullanırsınız.`],
          ['Aboneliği nasıl iptal ederim?', 'Abonelik sayfasından tek tıkla. Ödediğiniz dönemin sonuna kadar kullanmaya devam edersiniz.'],
          ['Verilerim güvende mi?', 'Veriler Google altyapısında şifreli saklanır, her servisin verisi diğerlerinden tamamen ayrıdır.'],
          ['e-Fatura kesebilir miyim?', 'Uygulama servis faturası ve teklif üretir. e-Fatura/e-Arşiv entegrasyonu yol haritamızda.']]
          .map(([q, a]) => h('details', null, h('summary', null, q), h('p', null, a)))),
      h('footer', { class: 'l-foot' }, h('span', null, `© ${new Date().getFullYear()} ${SP.config.appName}`), h('span', null, SP.config.supportEmail), h('span', null, SP.config.supportPhone))));
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
      h('label', { class: 'check' }, h('input', { type: 'checkbox', required: true }), h('span', null, 'Kullanım koşullarını ve KVKK aydınlatma metnini okudum, kabul ediyorum.')),
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
