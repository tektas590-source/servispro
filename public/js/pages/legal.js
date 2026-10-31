/* Yasal metinler: KVKK aydınlatma, abonelik (mesafeli satış) sözleşmesi, gizlilik & çerez, kullanım koşulları.
 * Bilgiler config.js > legal bölümünden gelir. Yayına almadan önce bir hukukçuya okutun.
 */
(function () {
  const SP = window.SP;
  const { h } = SP.ui;

  const L = () => SP.config.legal || {};
  const seller = () => {
    const l = L();
    return [l.name, l.address ? 'Adres: ' + l.address : null, l.taxNo ? `Vergi dairesi / no: ${l.taxOffice || '—'} / ${l.taxNo}` : null,
      `E-posta: ${SP.config.supportEmail}`, `Telefon: ${SP.config.supportPhone}`].filter(Boolean);
  };
  const court = () => (L().city ? `${L().city} Mahkemeleri ve İcra Daireleri` : 'Hizmet sağlayıcının yerleşim yerindeki Mahkemeler ve İcra Daireleri');
  const app = () => SP.config.appName;

  // Basit içerik yazımı: ['h', 'Başlık'], ['p', 'metin'], ['ul', [...]]
  const render = (blocks) => blocks.map(([t, c]) => (t === 'h' ? h('h2', null, c) : t === 'ul' ? h('ul', null, c.map((x) => h('li', null, x))) : h('p', null, c)));

  const DOCS = {
    kvkk: {
      title: 'KVKK Aydınlatma Metni',
      body: () => [
        ['p', `6698 sayılı Kişisel Verilerin Korunması Kanunu (“KVKK”) uyarınca, ${app()} hizmetini sunan ${L().name} (“Hizmet Sağlayıcı”) olarak kişisel verilerinizi aşağıda açıklanan kapsamda işlemekteyiz.`],
        ['h', '1. Veri sorumlusu'],
        ['ul', seller()],
        ['h', '2. Hangi verileri işliyoruz?'],
        ['ul', [
          'Kimlik ve iletişim: ad soyad, e-posta, telefon, servis/firma adı, adres.',
          'Müşteri işlem: abonelik paketi, ödeme bildirimleri, fatura bilgileri, destek yazışmaları.',
          'Finans: vergi dairesi/numarası; havale ile ödemede gönderen bilgisi. Kart bilgileri tarafımızca işlenmez.',
          'İşlem güvenliği: giriş kayıtları, IP adresi, tarayıcı ve cihaz bilgisi.',
        ]],
        ['h', '3. Servislerin kendi müşterilerine ait veriler'],
        ['p', `${app()} kullanan servisler; kendi müşterilerinin ad, telefon, plaka, araç ve işlem bilgilerini sisteme kendileri girer. Bu veriler bakımından ilgili servis “veri sorumlusu”, Hizmet Sağlayıcı ise yalnızca servisin talimatıyla ve hizmetin sunulması amacıyla veriyi saklayan “veri işleyen”dir. Bu kişilerin KVKK kapsamındaki başvuruları öncelikle ilgili servise yapılmalıdır.`],
        ['h', '4. İşleme amaçları'],
        ['ul', [
          'Üyelik oluşturma, kimlik doğrulama ve hizmetin sunulması,',
          'Abonelik, ödeme ve faturalandırma süreçlerinin yürütülmesi,',
          'Destek taleplerinin karşılanması ve bilgilendirme yapılması,',
          'Bilgi güvenliğinin sağlanması, kötüye kullanımın önlenmesi,',
          'Yasal yükümlülüklerin yerine getirilmesi ve yetkili mercilere bilgi verilmesi.',
        ]],
        ['h', '5. Hukuki sebepler'],
        ['p', 'Kişisel verileriniz KVKK m.5/2 kapsamında; sözleşmenin kurulması ve ifası (c), hukuki yükümlülüğün yerine getirilmesi (ç), bir hakkın tesisi, kullanılması veya korunması (e) ve meşru menfaatimiz (f) hukuki sebeplerine dayanılarak, elektronik ortamda otomatik yollarla işlenir.'],
        ['h', '6. Aktarım'],
        ['p', 'Veriler; altyapı ve barındırma hizmeti aldığımız bulut sağlayıcısına (Google Firebase), ödeme ve fatura hizmet sağlayıcılarına, hukuki ve mali danışmanlarımıza ve talep halinde yetkili kamu kurumlarına, işleme amaçlarıyla sınırlı olarak aktarılabilir. Bulut altyapısının sunucuları yurt dışında bulunabileceğinden, yurt dışına aktarım KVKK m.9’da öngörülen güvenceler ve şartlar çerçevesinde gerçekleştirilir.'],
        ['h', '7. Saklama süresi'],
        ['p', 'Veriler, üyelik süresince ve sona ermesinden sonra ilgili mevzuatta öngörülen süreler (ör. vergi mevzuatı kapsamında 10 yıl) boyunca saklanır; süre sonunda silinir, yok edilir veya anonim hale getirilir.'],
        ['h', '8. Haklarınız (KVKK m.11)'],
        ['p', 'Verilerinizin işlenip işlenmediğini öğrenme, bilgi talep etme, amacına uygun kullanılıp kullanılmadığını öğrenme, aktarıldığı kişileri bilme, eksik/yanlış işlenmişse düzeltilmesini, şartları oluşmuşsa silinmesini isteme, itiraz etme ve zararın giderilmesini talep etme haklarına sahipsiniz.'],
        ['p', `Başvurularınızı ${SP.config.supportEmail} adresine kayıtlı e-posta adresinizden iletebilirsiniz. Talepler en geç 30 gün içinde ücretsiz olarak sonuçlandırılır.`],
      ],
    },
    sozlesme: {
      title: 'Abonelik ve Mesafeli Hizmet Sözleşmesi',
      body: () => [
        ['h', '1. Taraflar'],
        ['p', 'Hizmet Sağlayıcı:'], ['ul', seller()],
        ['p', `Abone: ${app()} üzerinde hesap açan ve kayıt sırasında bilgilerini beyan eden gerçek veya tüzel kişi.`],
        ['h', '2. Konu'],
        ['p', `Bu sözleşme; ${app()} bulut tabanlı oto servis yönetim yazılımının (“Hizmet”) aylık abonelik usulüyle internet üzerinden kullandırılmasına ilişkin tarafların hak ve yükümlülüklerini düzenler. Sözleşme, kayıt sırasında elektronik ortamda onaylanmakla kurulur.`],
        ['h', '3. Paketler, ücret ve ödeme'],
        ['ul', [
          ...SP.PLAN_ORDER.map((k) => `${SP.PLANS[k].name}: aylık ${SP.PLANS[k].price.toLocaleString('tr-TR')} TL + KDV`),
          `Yeni hesaplar ${SP.config.trialDays} gün ücretsiz deneme ile başlar; deneme sonunda ücretli pakete geçilmezse hesap otomatik olarak ücretlendirilmez.`,
          SP.config.paymentMode === 'manual' ? 'Ödeme, abonelik ekranında belirtilen banka hesabına havale/EFT ile peşin yapılır. Abonelik, ödemenin hesaba geçmesi ile aktif edilir ve ödenen dönem kadar uzatılır.' : 'Ödeme, kredi/banka kartından her ay otomatik olarak tahsil edilir.',
          'Ücretler önceden duyurulmak kaydıyla değiştirilebilir; değişiklik, duyurudan sonraki ilk ödeme döneminden itibaren uygulanır.',
          'Her ödeme için Abone adına fatura düzenlenir.',
        ]],
        ['h', '4. Süre ve fesih'],
        ['ul', [
          'Abonelik aylık dönemler halindedir; taahhüt yoktur.',
          'Abone, bir sonraki dönemin ödemesini yapmayarak veya destek kanalından bildirerek aboneliğini dilediği zaman sonlandırabilir. Ödenmiş dönem sonuna kadar Hizmet kullanılabilir.',
          'Süresi biten hesapta kayıtlar okunabilir durumda kalır, yeni kayıt eklenemez. Abone, verilerinin bir kopyasını talep edebilir.',
          'Sözleşmeye veya mevzuata aykırı kullanım halinde Hizmet Sağlayıcı hesabı askıya alabilir veya sözleşmeyi feshedebilir.',
        ]],
        ['h', '5. Cayma hakkı'],
        ['p', 'Hizmet, Abone’nin onayı ile kayıt anında ifaya başlanan elektronik ortamda anında ifa edilen bir hizmettir. Abone’nin tüketici sayıldığı hallerde, Mesafeli Sözleşmeler Yönetmeliği m.15 uyarınca, ifasına onayla başlanan hizmetlerde cayma hakkı kullanılamaz. Ücretsiz deneme süresi, Abone’nin Hizmet’i satın almadan önce değerlendirmesi amacıyla sunulur.'],
        ['h', '6. Tarafların yükümlülükleri'],
        ['ul', [
          'Hizmet Sağlayıcı, Hizmet’i makul özen ve süreklilikle sunar; planlı bakım ve mücbir sebepler dışındaki kesintileri en kısa sürede giderir.',
          'Abone, hesap bilgilerinin gizliliğinden ve hesabı üzerinden yapılan işlemlerden sorumludur.',
          'Abone, sisteme girdiği kendi müşterilerine ait kişisel veriler bakımından veri sorumlusudur; bu verileri hukuka uygun şekilde topladığını ve gerekli aydınlatmayı yaptığını kabul eder.',
          `${app()} tarafından üretilen servis faturası ve teklif belgeleri bilgi amaçlıdır; resmi e-Fatura/e-Arşiv belgesi yerine geçmez. Vergi mevzuatına uyum Abone’nin sorumluluğundadır.`,
        ]],
        ['h', '7. Sorumluluğun sınırı'],
        ['p', 'Hizmet Sağlayıcı’nın bu sözleşmeden doğan toplam sorumluluğu, kasıt ve ağır ihmal halleri saklı kalmak kaydıyla, zarara yol açan olaydan önceki son 12 ayda Abone’nin ödediği abonelik bedeli ile sınırlıdır. Dolaylı zararlar ve kâr kaybından sorumluluk kabul edilmez.'],
        ['h', '8. Uyuşmazlıklar'],
        ['p', `Bu sözleşmeden doğan uyuşmazlıklarda Türk hukuku uygulanır. Abone’nin tüketici sayıldığı hallerde, Ticaret Bakanlığı’nca ilan edilen parasal sınırlar dahilinde Tüketici Hakem Heyetleri ve Tüketici Mahkemeleri; diğer hallerde ${court()} yetkilidir.`],
        ['h', '9. Yürürlük'],
        ['p', 'Abone, kayıt formundaki onay kutusunu işaretleyerek bu sözleşmenin tamamını okuduğunu ve kabul ettiğini beyan eder. Sözleşmenin güncel hali bu sayfada yayımlanır.'],
      ],
    },
    gizlilik: {
      title: 'Gizlilik ve Çerez Politikası',
      body: () => [
        ['p', `${app()}, kullanıcılarının gizliliğine önem verir. Bu politika, web sitesi ve uygulama kullanılırken hangi bilgilerin nasıl tutulduğunu açıklar. Kişisel verilerin işlenmesine ilişkin ayrıntılar KVKK Aydınlatma Metni’nde yer alır.`],
        ['h', 'Veri güvenliği'],
        ['ul', [
          'Tüm bağlantılar şifreli (HTTPS) yapılır.',
          'Her servisin verisi ayrı tutulur; erişim kuralları sunucu tarafında uygulanır, bir servis başka bir servisin verisini göremez.',
          'Şifreler tarafımızca görülemez; kimlik doğrulama altyapı sağlayıcısı tarafından şifrelenmiş olarak yönetilir.',
        ]],
        ['h', 'Çerezler ve tarayıcı depolama'],
        ['p', 'Sitemizde reklam veya izleme amaçlı çerez kullanılmaz. Yalnızca oturumun açık kalması ve uygulamanın çalışması için zorunlu teknik depolama (tarayıcı yerel depolaması ve kimlik doğrulama verileri) kullanılır. Bu veriler tarayıcı ayarlarından silinebilir; bu durumda yeniden giriş yapmanız gerekir.'],
        ['h', 'Üçüncü taraf hizmetler'],
        ['ul', [
          'Google Firebase (barındırma, kimlik doğrulama, veritabanı)',
          'Google Fonts (yazı tipleri)',
          'Ödeme ve e-fatura hizmet sağlayıcıları (yalnızca ilgili işlem sırasında)',
        ]],
        ['h', 'İletişim'],
        ['p', `Sorularınız için: ${SP.config.supportEmail} · ${SP.config.supportPhone}`],
      ],
    },
  };

  function legalPage(key) {
    return async (root) => {
      const d = DOCS[key];
      document.title = `${d.title} — ${app()}`;
      root.append(h('div', { class: 'legal-wrap' },
        h('header', { class: 'legal-top' }, h('a', { href: '#', class: 'brand' }, h('span', { class: 'logo' }, 'S'), h('b', null, app())),
          h('nav', null, Object.entries(DOCS).map(([k, x]) => h('a', { href: '#' + k, class: k === key ? 'on' : null }, x.title.split(' ')[0] === 'Abonelik' ? 'Sözleşme' : x.title.split(' ')[0])))),
        h('article', { class: 'legal' },
          h('h1', null, d.title),
          h('p', { class: 'muted small' }, 'Son güncelleme: ' + (L().updated || '')),
          render(d.body())),
        h('footer', { class: 'l-foot' }, h('span', null, `© ${new Date().getFullYear()} ${app()}`), h('a', { href: '#' }, 'Ana sayfa'))));
    };
  }
  SP.LEGAL = Object.keys(DOCS);
  SP.LEGAL_DOCS = DOCS;
  Object.keys(DOCS).forEach((k) => { SP.pages[k] = legalPage(k); });

  // Altbilgide kullanılacak bağlantılar
  SP.legalLinks = () => h('span', { class: 'legal-links' },
    h('a', { href: '#kvkk' }, 'KVKK'), ' · ', h('a', { href: '#sozlesme' }, 'Abonelik sözleşmesi'), ' · ', h('a', { href: '#gizlilik' }, 'Gizlilik & çerez'));
})();
