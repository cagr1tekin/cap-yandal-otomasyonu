# Çift Ana Dal ve Yan Dal Başvuru ve Takip Sistemi

Selçuk Üniversitesi bitirme projesi. Çift ana dal (ÇAP) ve yan dal başvurusunu kâğıttan çıkarır. Uygunluğu yönerge maddesine atıfla başvurudan önce gösterir. Sıralama, kurul kararı, kesin kayıt ve dönem sonu takibini tek yerde toplar. OBİS, e-Devlet, ÖSYM ve EBYS'nin yaptığı işleri yeniden yapmaz; onları okur ya da kullanıcıyı oraya yönlendirir.

> Bitirme projesidir, resmî sistem değildir. Arayüz selcuk.edu.tr'deki renk, yazı tipi ve bileşen ölçüleriyle yeniden yazılmıştır. Sitenin kodu ve logosu kullanılmaz.

| Belge | İçerik |
|---|---|
| [docs/PRD.md](docs/PRD.md) | Problem, kapsam, kural seti (KR-…), kullanıcı hikâyeleri |
| [docs/TEKNIK-DOKUMAN.md](docs/TEKNIK-DOKUMAN.md) | Mimari, veri modeli, API, güvenlik, test |
| [docs/GELISTIRME-PLANI.md](docs/GELISTIRME-PLANI.md) | Tema ölçüleri, aşamalar |
| [kaynaklar/](kaynaklar/KAYNAKLAR.md) | Yönergeler ve yönetmelik (PDF + metin) |
| [docs/ekranlar/](docs/ekranlar) | Ekran görüntüleri (uçtan uca testin ürettiği) |

## Yapı

```
apps/web         Next.js 15 (App Router) — arayüz, Auth.js (Keycloak)
apps/api         NestJS 11 — REST API, BullMQ işçisi, Prisma/PostgreSQL
apps/mock-obis   Sahte OBİS + ÖSYM doğrulama (yalnızca geliştirme/test)
packages/rules   Kural motoru (saf TypeScript, %100 test kapsamı)
packages/contracts  Ortak zod şemaları ve Türkçe etiketler
packages/seed-data  Programlar, kontenjanlar, deneme öğrencileri ve kullanıcılar
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
pnpm build                          # paketler + uygulamalar
pnpm db:migrate && pnpm db:seed
pnpm dev                            # web :3000, api :4000, mock-obis :4100
```

| Adres | Ne |
|---|---|
| http://localhost:3000 | Uygulama |
| http://localhost:4000/api/docs | API belgeleri (OpenAPI) |
| http://localhost:4100/obis | Sahte OBİS kesin kayıt ekranı |
| http://localhost:8035 | Mailpit (gönderilen e-postalar) |
| http://localhost:8088 | Keycloak (yönetici: admin/admin, yalnızca yerel) |

### Deneme hesapları

Tüm deneme kullanıcıları aynı yerel şifreyi kullanır: `packages/seed-data/src/users.ts` içindeki `DEV_PASSWORD`. Bu şifre yalnızca yerel Keycloak realm'inde geçerlidir.

| Kullanıcı | Rol | Senaryo |
|---|---|---|
| `230201001` | Öğrenci | İşletme, GNO 3,10, ilk %8. İktisat ÇAP için uygun |
| `230201002` / `230201003` | Öğrenci | GNO 2,75 (sınırda uygun) / 2,74 (uygun değil) |
| `230301004` | Öğrenci | YKS yolu. Belge no `YKS2025-0001234`, kod `AB12CD` |
| `230501006` | Öğrenci | Makine Müh. Bilgisayar Müh. ÇAP'ı yalnızca EEM'den alıyor |
| `220201007` | Öğrenci | Zaten etkin ÇAP'ı var |
| `220301008` / `220201009` / `220601010` | Öğrenci | Dönem sonu kayıt silme adayları |
| `220401011` | Öğrenci | ÇAP'tan ayrılırsa yan dal sertifikası hakkı doğar |
| `220201023` | Öğrenci | Ana dalda kaydı dondurulmuş |
| `koord.iktisat` | Koordinatör | İktisat ÇAP |
| `birim.iibf` | Birim öğrenci işleri | İİBF |
| `bolum.iktisat` | Bölüm başkanı | İktisat |
| `danisman.isletme` | Danışman | İşletme öğrencileri |
| `oidb.yonetici` | ÖİDB | Tüm birimler, kural setleri |

Tam liste `packages/seed-data/src/students.ts` dosyasındadır. Program ve kontenjanlar 2026-27 güz ilanından alınmıştır; sayılar temsilîdir. Öğrenciler sahtedir.

### Gösterim akışı

1. `230201001` ile giriş → **Programlar** → İktisat → **Başvur**.
2. `birim.iibf` → **Takvim** → İİBF ÇAP → **Başvuruyu şimdi kapat**.
3. `koord.iktisat` → **Koordinatörlük** → sıralama → **Öneriyi kilitle**.
4. `birim.iibf` → **Kararlar** → karar sayısı → **Kaydet** → **Yayımla**.
5. Öğrenci → **Başvurularım**: sonuç ve bildirim. Sahte OBİS ekranında kesin kayıt.
6. `birim.iibf` → **OBİS'ten kayıtları eşitle**, sonra **Taramalar** → **Taramayı başlat** → bulguyu onayla.

## Testler

```bash
pnpm --filter @cap/rules test    # 116 birim testi, %100 kapsam
pnpm --filter @cap/api test      # entegrasyon (cap_test veritabanı; önce: CREATE DATABASE cap_test)
pnpm e2e                         # Playwright: altyapı + mock-obis + api + web çalışıyor olmalı
```

Uçtan uca test, her koşudan önce veritabanını seed'e ve sahte OBİS'i başlangıç durumuna döndürür. Playwright tarayıcısı ilk seferde `pnpm --filter @cap/e2e exec playwright install chromium` ile kurulur.
