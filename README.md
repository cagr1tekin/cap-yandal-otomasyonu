# Çift Ana Dal ve Yan Dal Yönetim Paneli

Selçuk Üniversitesi bitirme projesi. Çift ana dal (ÇAP) ve yan dal süreçleri için **rol bazlı personel paneli**. Öğrenci başvurusunu bugünkü gibi birime dilekçeyle yapar. Panel, dilekçenin girişinden diplomaya kadar personelin işini dijitalleştirir:

- başvuru girişi ve belge kontrolü
- değerlendirme, sıralama ve kurul kararı
- belge kontrollü kesin kayıt
- beş imzalı Kabul ve Ders Protokolü
- dönemlik ders kayıt formu ve OBİS listesi
- dönem sonu taraması, dönem izinleri, ayrılma

Kararların kaynakları [docs/KARARLAR.md](docs/KARARLAR.md) dosyasındadır.

> Bitirme projesidir, resmî sistem değildir. Arayüz selcuk.edu.tr'deki renk, yazı tipi ve bileşen ölçüleriyle yeniden yazılmıştır; sitenin kodu ve logosu kullanılmaz.

| Belge | İçerik |
|---|---|
| [docs/KARARLAR.md](docs/KARARLAR.md) | Kapsam ve kuralların kaynaklı kararları (Kesin / Uygulama / Açık) |
| [docs/PRD.md](docs/PRD.md) | Problem, kural seti (KR-…), gereksinimler; v0.2 güncellemesi |
| [docs/TEKNIK-DOKUMAN.md](docs/TEKNIK-DOKUMAN.md) | Mimari, veri modeli, API, güvenlik, test |
| [kaynaklar/](kaynaklar/KAYNAKLAR.md) | Yönergeler, YÖK yönetmeliği, fakülte formları ([mevcut süreç](kaynaklar/mevcut-surec/MEVCUT-SUREC.md)) |
| [docs/ekranlar/](docs/ekranlar) | Uçtan uca testin ürettiği ekran görüntüleri |

## Roller

| Rol | Panelde yaptığı |
|---|---|
| Birim öğrenci işleri | Başvuru girişi, takvim, kurul kararı, sonuç ilanı, kesin kayıt, protokol dosyalama, OBİS'e girilecek ders listesi, dönem izni, ayrılma, tarama bulgusu kararı |
| Koordinatör | Sıralamayı inceleme ve öneriyi kilitleme, protokol ve ders kayıt formu hazırlama, öğrencinin ıslak imzasını işleme, formları toplu teslim |
| Bölüm başkanı | Teklif ve kontenjan; ana dal ya da hedef bölüm olarak protokol ve ders kayıt formu imzası; program danışmanı atama |
| Danışman | Protokol ve ders kayıt formu imzası, öğrencilerini izleme |
| ÖİDB | Kural setleri, kullanıcı ve rol yönetimi, denetim kaydı, tüm birimler |

Yetki, ÖİDB'nin panelde atadığı **rol ve kapsam** (birim / program) ile belirlenir; Keycloak yalnızca kimlik doğrular.

## Yapı

```
apps/web         Next.js 15 — rol bazlı panel (sol menü, Görevlerim, Onaylarım), next-auth (Keycloak)
apps/api         NestJS 11 — REST API, BullMQ (e-posta, tarama), Prisma/PostgreSQL
apps/mock-obis   Sahte OBİS + ÖSYM doğrulama (yalnızca geliştirme/test)
packages/rules   Kural motoru (saf TypeScript, 126 test, %100 kapsam)
packages/contracts  Ortak şemalar, belge listeleri, Türkçe etiketler
packages/seed-data  Programlar, temsilî müfredatlar, kontenjanlar, deneme öğrencileri ve personel
e2e              Playwright uçtan uca testleri
infra            docker-compose (PostgreSQL, Redis, Keycloak, Mailpit) + realm
```

## Kurulum

Gerekenler: Node 22+, pnpm 10, Docker.

```bash
pnpm install
pnpm --filter @cap/seed-data build && pnpm --filter @cap/seed-data realm   # infra/keycloak/realm.json
pnpm infra:up                       # PostgreSQL 5442, Redis 6389, Keycloak 8088, Mailpit 8035
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local   # NEXTAUTH_SECRET'a uzun rastgele bir değer girin
pnpm build
pnpm db:migrate && pnpm db:seed
pnpm dev                            # web :3000, api :4000, mock-obis :4100
```

| Adres | Ne |
|---|---|
| http://localhost:3000 | Panel |
| http://localhost:4000/api/docs | API belgeleri (OpenAPI) |
| http://localhost:8035 | Mailpit: öğrencilere giden e-postalar |
| http://localhost:8088 | Keycloak (yönetici: admin/admin, yalnızca yerel) |

### Deneme hesapları

Tüm personel hesapları aynı yerel şifreyi kullanır: `packages/seed-data/src/users.ts` içindeki `DEV_PASSWORD`. Yalnızca yerel Keycloak realm'inde geçerlidir.

| Kullanıcı | Rol |
|---|---|
| `birim.iibf` (`birim.fen`, `birim.iletisim`, …) | Birim öğrenci işleri |
| `koord.iktisat` (`koord.<program>`) | ÇAP / yan dal koordinatörü |
| `bolum.iktisat`, `bolum.isletme` (`bolum.<program>`) | Bölüm başkanı |
| `danisman.isletme` | Ana dal danışmanı |
| `oidb.yonetici` | ÖİDB |

Öğrenciler panel kullanıcısı değildir; başvuru girişinde öğrenci numarasıyla aranır. Deneme öğrencileri ve senaryoları `packages/seed-data/src/students.ts` dosyasındadır. Örnekler: `230201001` (uygun), `230201003` (GNO 2,74), `230301004` (YKS yolu; belge `YKS2025-0001234`, kod `AB12CD`).

### Gösterim akışı

1. `birim.iibf` → **Başvurular → Yeni başvuru girişi** → `230201001` → İktisat → evrak no → kaydet.
2. `birim.iibf` → **Takvim** → İİBF ÇAP → **Başvuruyu şimdi kapat**.
3. `koord.iktisat` → **Koordinatörlük** → İktisat → **Öneriyi kilitle**.
4. `birim.iibf` → **Kararlar** → karar no → kaydet → yayımla → Ayşe için **Kesin kaydı işle** (belgeler).
5. `koord.iktisat` → **Görevlerim** → kayıtlı öğrenci → **Protokol**: taslak → **İmzacılara gönder**.
6. `koord.iktisat`, `danisman.isletme`, `bolum.isletme`, `bolum.iktisat` → **Onaylarım** → onayla.
7. `birim.iibf` → kayıt sayfası → **Aslı öğrenci dosyasına kaldırıldı**.
8. `koord.iktisat` → kayıt sayfası → **Ders kayıt formu** → imzalar → **Toplu teslim**.
9. `birim.iibf` → **Ders kayıt formları** → OBİS listesi (CSV) → girildi olarak işaretle.

## Testler

```bash
pnpm --filter @cap/rules test    # 126 birim testi, %100 kapsam
pnpm --filter @cap/api test      # 17 entegrasyon testi (cap_test veritabanı; önce: CREATE DATABASE cap_test)
pnpm e2e                         # 13 Playwright testi: altyapı + mock-obis + api + web çalışıyor olmalı
```

Uçtan uca test her koşudan önce veritabanını seed'e ve sahte OBİS'i başlangıç durumuna döndürür. Playwright tarayıcısı ilk seferde `pnpm --filter @cap/e2e exec playwright install chromium` ile kurulur.
