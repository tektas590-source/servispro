/* ServisPro — yapılandırma
 * firebaseConfig boş bırakılırsa uygulama DEMO modunda (tarayıcı hafızası) çalışır.
 * Firebase Console > Proje Ayarları > Web uygulaması bölümündeki değerleri buraya yapıştırın.
 */
window.SP = window.SP || {};
SP.pages = SP.pages || {};

SP.config = {
  appName: 'ServisPro',
  firebaseConfig: {
    apiKey: "AIzaSyBHAIbap3A1xmpjmiCNCNliy-eI8Mhtg1k",
    authDomain: "servispro-b7732.firebaseapp.com",
    projectId: "servispro-b7732",
    storageBucket: "servispro-b7732.firebasestorage.app",
    messagingSenderId: "811867300610",
    appId: "1:811867300610:web:2cbe0500c8edaf601e981b",
  },
  functionsRegion: 'europe-west1',
  firebaseVersion: '10.14.1',
  // Platform sahibi (siz) — bu e-postalar Yönetici panelini görür
  adminEmails: ['tektas590@gmail.com'],
  trialDays: 14,
  // Ödeme yöntemi: 'manual' = havale/EFT (siz panelden aktif edersiniz), 'iyzico' = kartla otomatik abonelik
  paymentMode: 'manual',
  bank: {
    accountHolder: '',          // Hesap sahibi adı soyadı / ünvan
    bankName: '',               // Banka adı
    iban: '',                   // TR.. IBAN
  },
  vatRate: 20,
  supportPhone: '0 (5xx) xxx xx xx',
  supportEmail: 'destek@servispro.com.tr',
};

/* Paketler — fiyatları ve limitleri buradan değiştirin.
 * iyzico panelinde oluşturduğunuz ödeme planı referans kodları functions tarafında tanımlanır.
 * Sınır değeri null = sınırsız.
 */
SP.PLANS = {
  baslangic: {
    id: 'baslangic', name: 'Başlangıç', price: 499,
    tagline: 'Tek kişilik küçük servisler için',
    limits: { users: 1, workOrdersPerMonth: 100, parts: 500, compat: false },
    features: ['1 kullanıcı', 'Ayda 100 iş emri', '500 stok kartı', 'Müşteri & araç kayıtları', 'Randevu takvimi', 'Fatura & tahsilat'],
  },
  profesyonel: {
    id: 'profesyonel', name: 'Profesyonel', price: 999, popular: true,
    tagline: 'Büyüyen servisler için',
    limits: { users: 5, workOrdersPerMonth: null, parts: null, compat: true },
    features: ['5 kullanıcı', 'Sınırsız iş emri', 'Sınırsız stok kartı', 'Parça–araç uyumluluğu', 'Cari hesap takibi', 'Başlangıç’taki her şey'],
  },
  kurumsal: {
    id: 'kurumsal', name: 'Kurumsal', price: 1799,
    tagline: 'Yetkili ve çok ustalı servisler için',
    limits: { users: 25, workOrdersPerMonth: null, parts: null, compat: true },
    features: ['25 kullanıcı', 'Sınırsız her şey', 'Öncelikli telefon desteği', 'Eski sistemden veri aktarımı', 'Profesyonel’deki her şey'],
  },
};
SP.PLAN_ORDER = ['baslangic', 'profesyonel', 'kurumsal'];
SP.VAT_DEFAULT = 20;
