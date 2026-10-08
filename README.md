# Bilgisayar Mühendisliği Çift Ana Dal ve Yan Dal Otomasyonu

Selçuk Üniversitesi bitirme projesi. Teknoloji Fakültesi **Bilgisayar Mühendisliği Bölümünde** çift ana dal (ÇAP) ya da yan dal yapmak isteyen öğrencilerin ve bölümün ÇAP komisyonunun kullandığı web uygulaması.

- Öğrenci hesabını açar, **bilgilerini kendisi girer**, belgesini yükler, uygunluğunu kural kural görür ve çevrim içi başvurur.
- Komisyon beyanı belgeyle doğrular, sıralar, kurul kararını işler ve sonucu ilan eder.
- Protokol bölümün gerçek protokollerinden üretilir ve beş imzayla; ders kayıt formu ve özel şartlı ders muafiyeti formu üç imzayla tamamlanır.
- Not girişi, dönem sonu beyanı ve taraması, izinler, ayrılma, mezuniyet denetimi.

OBİS bağlantısı yoktur; veriler sistemde tutulur. Kapsam ve kararların kaynakları [docs/KARARLAR.md](docs/KARARLAR.md) dosyasındadır (K-12 ve sonrası).

> Bitirme projesidir, resmî sistem değildir. Arayüz selcuk.edu.tr'deki renk, yazı tipi ve bileşen ölçüleriyle yeniden yazılmıştır; sitenin kodu ve logosu kullanılmaz.

| Belge | İçerik |
|---|---|
| [docs/taslak/Proje-Taslak-Dosyasi.pdf](docs/taslak/Proje-Taslak-Dosyasi.pdf) | Proje taslak dosyası: teknolojiler, roller, ekranlar, veriler, **veritabanı şeması**, kurallar |
| [docs/KARARLAR.md](docs/KARARLAR.md) | Kapsam ve kuralların kaynaklı kararları |
| [docs/PRD.md](docs/PRD.md), [docs/TEKNIK-DOKUMAN.md](docs/TEKNIK-DOKUMAN.md) | Gereksinimler ve mimari (son bölümleri güncel kapsamı anlatır) |
| [kaynaklar/](kaynaklar/KAYNAKLAR.md) | Yönergeler, YÖK yönetmeliği, [bölüm sitesindeki belgeler](kaynaklar/bolum-sitesi/README.md), hocanın verdiği materyaller |
| [docs/ekranlar/](docs/ekranlar) | Uçtan uca testin ürettiği ekran görüntüleri |

## Roller

| Rol | Yaptığı |
|---|---|
| Öğrenci | Bilgi ve belge girişi, başvuru, kesin kayıt onayı, protokol imzası, ders kayıt formu, muafiyet başvurusu, dönem sonu beyanı, ayrılma |
| Koordinatör (ÇAP komisyonu) | Kontenjan ve takvim, beyan doğrulama, sıralama, karar ve ilan, protokol şablonları, protokol, imza, not girişi, tarama ve bulgu kararı, kural setleri |
| Bölüm başkanı (Bilgisayar Müh.) | Protokol imzası, kullanıcı ve rol yönetimi, denetim kaydı, raporlar |
| Ana dal danışmanı / ana dal bölüm başkanı | Yalnız kendi bölümünün öğrencilerini görür ve formlarını imzalar |

Personel rolünü Bilgisayar Mühendisliği bölüm başkanı atar; rolü olmayan her hesap öğrenci hesabıdır. Keycloak yalnızca kimlik doğrular.

## Yapı

```
apps/web            Next.js 15: öğrenci ve personel ekranları, yazdırılabilir formlar, next-auth (Keycloak)
apps/api            NestJS 11: REST API, BullMQ (e-posta, tarama), Prisma/PostgreSQL, belge deposu
packages/rules      Kural motoru (saf TypeScript, 126 test, %100 kapsam)
packages/contracts  Ortak şemalar, imzacı tanımları, Türkçe etiketler
packages/seed-data  Gerçek müfredat ve protokoller; uydurma öğrenciler ve personel
e2e                 Playwright uçtan uca testleri
infra               docker-compose (PostgreSQL, Redis, Keycloak, Mailpit) + realm
docs/taslak         Taslak dosyası ve üretim betiği (veritabanı bölümü şemadan üretilir)
```

## Kurulum

Gerekenler: Node 22+, pnpm 10, Docker.

```bash
pnpm install
pnpm --filter @cap/seed-data build && pnpm --filter @cap/seed-data realm   # infra/keycloak/realm.json
pnpm infra:up                       # PostgreSQL 5442, Redis 6389, Keycloak 8088, Mailpit 8035
docker exec cap-yandal-postgres-1 psql -U cap -d postgres -c "CREATE DATABASE cap_bm" -c "CREATE DATABASE cap_bm_test"
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local   # NEXTAUTH_SECRET'a uzun rastgele bir değer girin
pnpm build
pnpm --filter @cap/api db:deploy && pnpm db:seed
pnpm dev                            # web :3000, api :4000
```

| Adres | Ne |
|---|---|
| http://localhost:3000 | Uygulama |
| http://localhost:4000/api/docs | API belgeleri (OpenAPI) |
| http://localhost:8035 | Mailpit: gönderilen e-postalar |
| http://localhost:8088 | Keycloak (yönetici: admin/admin, yalnızca yerel) |

### Deneme hesapları

Bütün deneme hesapları aynı yerel şifreyi kullanır: `packages/seed-data/src/users.ts` içindeki `DEV_PASSWORD`. Yalnızca yerel Keycloak realm'inde geçerlidir. Yeni öğrenci hesabı, giriş ekranındaki "Kayıt ol" bağlantısıyla da açılabilir.

| Kullanıcı | Rol |
|---|---|
| `koord.bilgisayar`, `koord.uye` | ÇAP / yan dal komisyonu |
| `bolum.bilgisayar` | Bilgisayar Mühendisliği bölüm başkanı (yönetici) |
| `danisman.eem`, `bolum.eem` | Elektrik-Elektronik Müh. danışmanı ve bölüm başkanı (imzacı) |
| `danisman.makine`, `bolum.makine` | Makine Müh. danışmanı ve bölüm başkanı (imzacı) |
| `253302001` … `243303017` | Öğrenciler (kullanıcı adı = öğrenci numarası) |

Öğrenci senaryoları `packages/seed-data/src/students.ts` dosyasındadır. Örnekler: `253302001` (uygun), `253302003` (GNO 2,74: ÇAP'a uygun değil, yan dala uygun), `253302004` (taban puan yolu), `253303008` (Makine: 2026-27 güzde ÇAP yalnız EEM'ye açık), `253302012` (bilgilerini henüz girmemiş), `243302013` (geçen yıldan kayıtlı).

### Gösterim akışı

1. `253302012` → **Bilgilerim**: bilgileri gir, YKS belgesini yükle → **Başvuru**: kuralları gör, başvur.
2. `koord.bilgisayar` → **Başvurular**: beyanı belgeyle karşılaştır, doğrula → **Kontenjan ve takvim**: başvuruyu kapat.
3. `koord.bilgisayar` → **Sıralama ve karar**: öneriyi kilitle, karar sayısını gir, sonucu yayımla.
4. `253302001` → **Başvuru**: kesin kaydı onayla.
5. `koord.bilgisayar` → öğrencinin kayıt sayfası: **protokolü şablondan üret**, imzaya gönder.
6. `253302001`, `danisman.eem`, `bolum.eem`, `bolum.bilgisayar` → **İmzalarım**: imzala.
7. `253302001` → kayıt sayfası: **ders kayıt formu** (dersler ve teknik seçmeli), imzaya gönder → danışman ve komisyon imzalar.
8. `koord.bilgisayar` → **not girişi**; `253302001` → **özel şartlı ders muafiyeti** başvurusu.
9. `koord.bilgisayar` → **Dönem sonu taramaları**: 2025-2026 Bahar taraması, bulgulara karar.
10. `bolum.bilgisayar` → **Kullanıcılar ve roller**, **Denetim kaydı**, **Raporlar**.

## Testler

```bash
pnpm --filter @cap/rules test    # 126 birim testi, %100 kapsam
pnpm --filter @cap/api test      # 19 entegrasyon testi (cap_bm_test veritabanı)
pnpm e2e                         # 18 Playwright testi: altyapı + api + web çalışıyor olmalı
node docs/taslak/build.cjs       # taslak dosyasını (HTML + PDF) şemadan yeniden üretir
```

Uçtan uca test her koşudan önce veritabanını seed durumuna döndürür. Playwright tarayıcısı ilk seferde `pnpm --filter @cap/e2e exec playwright install chromium` ile kurulur.

## Gerçek ve temsilî veri

Müfredat (118 ders) Bologna ders paketinden, iki ÇAP protokolü (EEM 135 AKTS ve 8 özel şart; Makine 171 AKTS ve 2 özel şart) bölüm sitesinden bire bir alınmıştır. Kontenjan sayıları, taban puanlar ve yan dal ders havuzu temsilîdir; öğrenci ve personel adları uydurmadır. Ayrıntı: KARARLAR K-16.
