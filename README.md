# Bilgisayar Mühendisliği ÇAP ve YDP Öğrenci Takip Sistemi

Selçuk Üniversitesi bitirme projesi. Teknoloji Fakültesi **Bilgisayar Mühendisliği Bölümüne** gelen çift ana dal (ÇAP) ve yan dal (YDP) öğrencilerinin bugün kâğıt ve formla yapılan takibini tek bir web uygulamasına taşır:

- öğrencinin alacağı dersler, her dersin hangi dönemde alındığı, notu ve kaçıncı denemede geçildiği,
- tamamlanan ve kalan dersler (AKTS ile), mezuniyete ya da sertifikaya ne kadar kaldığı,
- belgeler (imzalı formlar, not belgeleri, resmî yazılar) ve sürümleri,
- öğrenciyle kalıcı yazışma,
- yönerge kurallarına göre uyarılar; kararı koordinatör verir.

Sistemin tek esas kaynağı danışman hocanın [çerçeve e-postasıdır](kaynaklar/hoca-materyalleri/cerceve-eposta.md). Başvuru değerlendirme ve öğrenci seçimi sistemde yapılmaz (dekanlıkta); koordinatör kabul edilen öğrenciyi ekler. OBİS bağlantısı yoktur, veri elle ya da CSV ile girilir; tasarım ileride OBİS'ten veri alınabilecek biçimdedir. Kararların kaynakları: [docs/KARARLAR.md](docs/KARARLAR.md) (güncel kapsam K-18 ve sonrası).

> Bitirme projesidir, resmî sistem değildir. Bütün öğrenci ve personel verisi sentetiktir. Arayüz selcuk.edu.tr'deki renk, yazı tipi ve bileşen ölçüleriyle yeniden yazılmıştır; sitenin kodu ve logosu kullanılmaz.

| Belge | İçerik |
|---|---|
| [docs/taslak/Proje-Taslak-Dosyasi.pdf](docs/taslak/Proje-Taslak-Dosyasi.pdf) | Proje taslak dosyası: roller, ekranlar, akış, kurallar, güvenlik, **veritabanı şeması** |
| [docs/KARARLAR.md](docs/KARARLAR.md) | Kaynaklı kararlar ve hocaya bildirilecek çelişkiler |
| [docs/GUVENLIK.md](docs/GUVENLIK.md) | Sızma testleri ve alınan önlemler |
| [docs/PRD.md](docs/PRD.md), [docs/TEKNIK-DOKUMAN.md](docs/TEKNIK-DOKUMAN.md) | Gereksinimler ve mimari (son bölümleri güncel kapsamı anlatır) |
| [kaynaklar/](kaynaklar/KAYNAKLAR.md) | Yönergeler, bölüm sitesindeki belgeler, hocanın verdiği materyaller |
| [docs/ekranlar/](docs/ekranlar) | Uçtan uca testin ürettiği ekran görüntüleri |

## Roller

Üç giriş vardır, başka rol yoktur. Hesapları koordinatör açar; kendi kendine kayıt kapalıdır.

| Rol | Yaptığı |
|---|---|
| Koordinatör | Öğrenci ve hesap ekler; öğrencinin girdiği kayıtları ve belgeleri onaylar ya da gerekçeyle reddeder; ek belge ister; öğrencinin göremediği not yazar; ders kataloğu, ders listesi şablonları, dönemler, ayarlar ve kural sürümleri; GANO girişi (kaynağıyla); düzeltme ve iptal (gerekçeyle); geriye dönük giriş ve CSV aktarımı; mezuniyet, sertifika ve kayıt silme kararı |
| Öğrenci | Yalnız kendi kartı: imzalı formları yükler, ders listesine katalogdan ders ekler (katalogda yoksa talep gönderir), her dönem aldığı dersleri ve dönem sonu notlarını girer (ÇAP/YDP not belgesi zorunlu), mesajlaşır, durumunu görür |
| Bölüm başkanı | Yalnız izler: bütün kartlar, kural kontrolleri, işlem kaydı. Hiçbir şeyi değiştiremez |

Öğrencinin girdiği her kayıt **onay bekliyor** başlar, onaylanınca kilitlenir ve ancak o zaman kural hesabına girer. Hiçbir kayıt silinmez; yanlış kayıt gerekçeyle **iptal** edilir.

## Yapı

```
apps/web            Next.js 15: üç rolün ekranları, yazdırılabilir formlar, next-auth (kullanıcı adı + şifre)
apps/api            NestJS 11: REST API, Prisma/PostgreSQL, belge deposu, BullMQ e-posta kuyruğu, giriş ve şifre belirleme (scrypt, imzalı oturum belirteci)
packages/rules      Kural motoru (saf TypeScript, 135 test, %100 kapsam)
packages/contracts  Ortak şemalar, durumlar, ayarlar, Türkçe etiketler
packages/seed-data  Gerçek müfredat ve ders listesi şablonları; sentetik öğrenciler ve personel
e2e                 Playwright uçtan uca testleri
infra               docker-compose (PostgreSQL, Redis, Mailpit)
docs/taslak         Taslak dosyası ve üretim betiği (veritabanı bölümü şemadan üretilir)
```

## Kurulum

Gerekenler: Node 22+, pnpm 10, Docker.

```bash
pnpm install
pnpm infra:up                       # PostgreSQL 5442, Redis 6389, Mailpit 8035
docker exec cap-yandal-postgres-1 psql -U cap -d postgres -c "CREATE DATABASE cap_takip" -c "CREATE DATABASE cap_takip_test"
cp apps/api/.env.example apps/api/.env       # AUTH_SECRET'a uzun rastgele bir değer girin
cp apps/web/.env.example apps/web/.env.local   # NEXTAUTH_SECRET'a uzun rastgele bir değer girin
pnpm build
pnpm --filter @cap/api db:deploy && pnpm db:seed
pnpm dev                            # web :3000, api :4000
```

| Adres | Ne |
|---|---|
| http://localhost:3000 | Uygulama |
| http://localhost:4000/api/docs | API belgeleri (OpenAPI) |
| http://localhost:8035 | Mailpit: şifre belirleme ve bildirim e-postaları |

### Deneme hesapları

Seed hesapları aynı yerel şifreyi kullanır: `packages/seed-data/src/users.ts` içindeki `DEV_PASSWORD`. Canlı ortamda seed `SEED_PASSWORD` ile çalıştırılır, bu şifre orada geçmez. Koordinatörün yeni eklediği öğrenci şifresini Mailpit'e düşen bağlantıyla kendisi belirler.

| Kullanıcı | Rol |
|---|---|
| `koord.bilgisayar` | Koordinatör |
| `bolum.bilgisayar` | Bölüm başkanı |
| öğrenci numarası (ör. `253302009`) | Öğrenci |

Öğrenci senaryoları (`packages/seed-data/src/students.ts`):

| No | Durum |
|---|---|
| `253302001` | Yeni ÇAP öğrencisi; imzalı protokolü onay bekliyor |
| `253302009` | Ders listesi şablondan; onay bekleyen dönem dersleri |
| `253303008` | YDP; ders listesi onay bekliyor |
| `243302013` | Olağan ÇAP; bir dersi tekrar alıyor |
| `243303014` | GANO uyarısı (ilk düşüş hakkı) |
| `243302015` | GANO kural dışı (ikinci düşüş) |
| `243302016` | Hiç ders almamış; hesabına davet gönderilmemiş |
| `243303017` | Olağan YDP |
| `233302020` | YDP; sertifika koşulları sağlanıyor |

### Gösterim akışı

1. `koord.bilgisayar` → **Öğrenciler** → "Kabul edilen öğrenciyi ekle". Mailpit'teki bağlantıyla öğrenci şifresini belirler.
2. Öğrenci → **Belgeler**: imzalı protokolü yükler. **Dersler**: katalogdan ders ekler.
3. Koordinatör → **Onay bekleyenler**: onaylar ya da gerekçeyle reddeder. Öğrenci kartında "Şablondaki eksik dersleri ekle".
4. Öğrenci → **Dersler**: bu dönem aldığı dersi girer; koordinatör onaylar.
5. Öğrenci → **Dönem sonu notları**: ÇAP/YDP not belgesini yükler, notları gönderir; koordinatör belgeyle karşılaştırıp onaylar.
6. Mesajlar ve koordinatör notları; belge isteği.
7. Koordinatör → `243302013` kartında GANO girer → uyarı; `233302020` kartında sertifika kararını dayanağıyla kaydeder.
8. Koordinatör → **Yönerge kuralları**: yeni sürüm, taslakta dene, yürürlüğe koy. **İçeri aktar (CSV)**: dene, sonra yaz.
9. `bolum.bilgisayar` → her şeyi görür, hiçbir şeyi değiştiremez; **İşlem kaydı**.

## Testler

```bash
pnpm --filter @cap/rules test    # 135 birim testi, %100 kapsam
pnpm --filter @cap/api test      # 35 entegrasyon testi: 17 akış + 18 sızma testi (cap_takip_test veritabanı)
pnpm e2e                         # 18 Playwright testi: altyapı + api + web çalışıyor olmalı
node docs/taslak/build.cjs       # taslak dosyasını (HTML + PDF) şemadan yeniden üretir
```

Uçtan uca test her koşudan önce veritabanını seed durumuna döndürür ve Mailpit'teki gerçek davet e-postasıyla şifre belirler. Playwright tarayıcısı ilk seferde `pnpm --filter @cap/e2e exec playwright install chromium` ile kurulur.

## Gerçek ve sentetik veri

Müfredat (118 ders) Bologna ders paketinden, ÇAP ders listesi şablonları (EEM 135 AKTS, Makine 171 AKTS) bölüm sitesindeki protokollerden alınmıştır. Yan dal ders listesi şablonu temsilîdir. Öğrenciler, personel, notlar ve belgeler sentetiktir. Ayrıntı: KARARLAR K-16.
