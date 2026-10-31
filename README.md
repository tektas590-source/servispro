# ServisPro — Oto Servis Yazılımı (aylık abonelikli SaaS)

Oto servislere aylık abonelikle satılan bulut yazılım. Her servis kendi hesabını açar, 14 gün ücretsiz dener, sonra iyzico ile kartından her ay otomatik ödeme yapar. Siz de **Platform yönetimi** ekranından tüm müşterilerinizi ve aylık gelirinizi görürsünüz.

## Modüller

| Modül | Neler var |
|---|---|
| Müşteri & araç | Bireysel/kurumsal müşteri, plaka-şasi-motor-km, servis geçmişi, cari bakiye |
| Randevu | Günlük/haftalık liste, WhatsApp hatırlatma, "Araç geldi" → iş emri |
| İş emri | Araç kabul, şikayet/tespit, parça + işçilik kalemleri, iskonto, KDV, durum takibi, yazdırılabilir kabul formu |
| Stok & parça | Stok kartı, OEM no, raf, kritik stok, giriş/çıkış/sayım, hareket geçmişi; iş emri "Hazır" olunca stok otomatik düşer |
| Parça–araç uyumluluğu | Her parçaya marka/model/yıl aralığı/motor kuralı; iş emrinde uyumlu parçalar üstte, uyumsuz parçaya uyarı; "Araca göre bul" |
| Fatura & tahsilat | İş emrinden fatura veya teklif, teklif → fatura, kısmi tahsilat, cari tahsilat, aylık kasa raporu, yazdır/PDF, WhatsApp ile gönder |
| Abonelik | 3 paket (Başlangıç / Profesyonel / Kurumsal), 14 gün deneme, iyzico abonelik, paket değiştirme, iptal |
| Ekip | Personel davet etme, paket kullanıcı limiti |

## Paketler (fiyatları `public/js/config.js` içinden değiştirin)

| | Başlangıç | Profesyonel | Kurumsal |
|---|---|---|---|
| Aylık | 499 ₺ + KDV | 999 ₺ + KDV | 1.799 ₺ + KDV |
| Kullanıcı | 1 | 5 | 25 |
| İş emri | 100/ay | sınırsız | sınırsız |
| Stok kartı | 500 | sınırsız | sınırsız |
| Parça–araç uyumluluğu | — | ✓ | ✓ |

Deneme süresinde Profesyonel paketin tamamı açıktır. Abonelik bitince servis kayıtlarını görmeye devam eder ama yeni kayıt ekleyemez (kural Firestore'da da uygulanır).

## Klasör yapısı

```
servispro/
├─ public/               ← web uygulaması (derleme gerekmez, doğrudan yayınlanır)
│  ├─ index.html
│  ├─ css/app.css
│  └─ js/
│     ├─ config.js       ← Firebase ayarları, paket fiyatları, admin e-postası
│     ├─ store.js        ← veri katmanı (Demo + Firebase)
│     ├─ core.js         ← abonelik, limit, KDV, uyumluluk kuralları
│     └─ pages/*.js      ← ekranlar
├─ functions/            ← iyzico abonelik fonksiyonları (Node 20)
├─ firestore.rules       ← güvenlik kuralları (servisler birbirinin verisini göremez)
└─ firebase.json
```

## 1) Bilgisayarınızda deneyin (demo modu)

`config.js` içindeki `firebaseConfig` boşken uygulama tarayıcı hafızasıyla çalışır:

```bash
cd servispro/public
npx serve .          # veya: python -m http.server 8080
```
Tarayıcıda açın → **Demoyu incele** (demo@servispro.com / demo123).

## 2) Firebase kurulumu

1. https://console.firebase.google.com → **Proje ekle** (ör. `servispro`).
2. **Authentication → Başlayın → E-posta/Şifre**'yi açın.
3. **Firestore Database → Veritabanı oluştur** → konum `europe-west1` (veya `eur3`).
4. **Proje ayarları → Uygulamalarınız → Web (</>)** → çıkan `firebaseConfig` değerlerini `public/js/config.js` içine yapıştırın.
5. Proje planını **Blaze (kullandıkça öde)** yapın — Cloud Functions ve iyzico'ya dışarı istek için gerekli. Küçük ölçekte ücret genelde ücretsiz kota içinde kalır; bütçe uyarısı koyun.
6. Bilgisayarınızda:
   ```bash
   npm i -g firebase-tools
   firebase login
   cd servispro
   firebase use --add          # projenizi seçin (.firebaserc güncellenir)
   cd functions && npm install && cd ..
   ```

## 3) iyzico abonelik kurulumu

1. https://sandbox-merchant.iyzipay.com adresinden **sandbox** hesabı açın (test için).
2. **Abonelik → Ürünler → Yeni ürün**: "ServisPro".
3. Ürünün altında 3 **ödeme planı** oluşturun: Başlangıç 499 ₺, Profesyonel 999 ₺, Kurumsal 1.799 ₺ — Aylık, para birimi TRY (KDV dahil fiyat girecekseniz KDV'li tutarı yazın).
4. Her planın **referans kodunu** not edin.
5. **Ayarlar → Bildirimler (Webhook)**: `https://<APP_URL>/api/iyzico/webhook` adresini girin.
6. API anahtarlarını Firebase'e gizli olarak kaydedin:
   ```bash
   firebase functions:secrets:set IYZICO_API_KEY
   firebase functions:secrets:set IYZICO_SECRET_KEY
   ```
7. `functions/.env` dosyası oluşturun:
   ```
   IYZICO_BASE_URL=https://sandbox-api.iyzipay.com
   APP_URL=https://<proje-id>.web.app
   PLAN_BASLANGIC=<referans-kodu>
   PLAN_PROFESYONEL=<referans-kodu>
   PLAN_KURUMSAL=<referans-kodu>
   ```

## 4) Yayınlama

```bash
firebase deploy
```
Uygulama `https://<proje-id>.web.app` adresinde açılır. Kendi alan adınızı (ör. servispro.com.tr) **Hosting → Özel alan adı ekle** ile bağlayın ve `APP_URL`'i güncelleyin.

**Test kartı (sandbox):** 5528 7900 0000 0008 · SKT 12/30 · CVC 123

## 5) Platform yöneticisi

`config.js` → `adminEmails` ve `firestore.rules` → `isAdmin()` içinde kendi e-postanız tanımlı. Bu e-postayla kayıt olup **e-postanızı doğrulayın** (kayıtta doğrulama e-postası gönderilir); sol menüde **Platform yönetimi** görünür: toplam servis, ücretli abone, denemedeki servis, aylık gelir.

## 6) Canlıya geçmeden önce kontrol listesi

- [ ] iyzico'da **canlı üye işyeri** başvurusu (şirket/şahıs şirketi, vergi levhası, IBAN). Onay sonrası `IYZICO_BASE_URL=https://api.iyzipay.com`, canlı API anahtarları ve canlı plan referans kodları.
- [ ] Sitede **Mesafeli Satış Sözleşmesi**, **İptal/İade koşulları**, **KVKK Aydınlatma Metni** ve **Gizlilik Politikası** sayfaları (iyzico başvurusunda da istenir).
- [ ] Abonelik ücretleri için müşterilerinize **e-Arşiv/e-Fatura** kesmeniz gerekir (iyzico fatura kesmez). Bir entegratörle (Paraşüt, Logo İşbaşı, Uyumsoft vb.) aylık otomatik fatura kurabilirsiniz.
- [ ] Firebase **App Check** ve bütçe uyarısı.
- [ ] Destek telefonu/e-postası (`config.js`).

## Bilinen sınırlar / yol haritası

- Uygulamanın kestiği servis faturası **bilgi amaçlıdır**, resmi e-Fatura/e-Arşiv değildir. Sonraki adım: GİB entegratörü bağlantısı.
- Paket limitleri (kullanıcı, iş emri, stok kartı) arayüzde uygulanır; yazma yetkisi ve abonelik süresi Firestore kurallarıyla sunucuda da korunur.
- Listeler servisin tüm kayıtlarını yükler; on binlerce kayda ulaşan servisler için sayfalama eklenmeli.
- Eurorepar eDMS / TecDoc gibi kataloglardan uyumluluk verisi içe aktarma (CSV) eklenebilir.
