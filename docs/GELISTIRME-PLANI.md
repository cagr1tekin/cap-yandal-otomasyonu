# Geliştirme Planı

| | |
|---|---|
| Tarih | 2026-10-07 |
| Dayanak | [PRD.md](PRD.md), [TEKNIK-DOKUMAN.md](TEKNIK-DOKUMAN.md) |
| Ortam | Windows 11, Node 22, pnpm 10, Docker 29 |

## 1. Arayüz teması (selcuk.edu.tr'den ölçüldü)

| Jeton | Değer | Kullanım |
|---|---|---|
| `--su-primary` | `#1C458B` | Üst menü zemini, birincil düğme, bağlantı |
| `--su-primary-dark` | `#0D2D5E` | Alt bilgi, üzerine gelme (hover) |
| `--su-primary-soft` | `rgba(28,69,139,.08)` | Seçili satır, rozet zemini |
| `--su-accent` | `#FFC90D` | Vurgu düğmesi ("Hızlı Menü" stili), etkin sekme çizgisi |
| `--su-bg` | `#F6F8FC` | Sayfa zemini |
| `--su-border` | `#CBD5E1` | Kenarlıklar |
| `--su-text` | `#212529` | Gövde metni |
| `--su-muted` | `#475569` | İkincil metin |
| Yazı tipi | Montserrat | Gövde 16px, harf aralığı 0.32px; başlık ağırlığı 500 |
| Menü öğesi | 13px / 500, büyük harf, hap biçimi (999px) | Üst menü |

**Kopyalama sınırı:** Görünüm, ölçülen değerlerle **yeniden yazılır**. Sitenin CSS ve JS dosyaları ile logosu projeye alınmaz. Sebepleri: bunlar üniversitenin kodu ve tescilli kimliği, ayrıca sistem resmî site gibi görünmemeli. Logo yerine metin amblemi kullanılır. Resmî logo, izin alınırsa `apps/web/public/logo.svg` olarak eklenebilir. Her sayfanın alt bilgisinde "Bitirme projesi, resmî sistem değildir" ibaresi yer alır.

## 2. Aşamalar

Her aşama bir sonraki başlamadan önce kendi "bitti" ölçütünü sağlar.

| Aşama | İçerik | Bitti ölçütü |
|---|---|---|
| **A0 — İskelet** | pnpm workspace, Turborepo, TS/ESLint/Prettier ayarları, `infra/docker-compose.yml` (PostgreSQL, Redis, Keycloak, Mailpit), `.env.example`, git deposu | `pnpm install` ve `docker compose up` hatasız |
| **A1 — Kural motoru** | `packages/rules`: tipler, 19 değerlendirici, kural seti JSON'u (PRD bölüm 5), `evaluate()` ve karar hesabı, sınır değer testleri | `pnpm --filter rules test` yeşil, dal kapsamı %100 |
| **A2 — Sözleşmeler** | `packages/contracts`: zod şemaları, enum'lar, DTO'lar | Tip denetimi yeşil |
| **A3 — Sahte OBİS** | `apps/mock-obis` (NestJS): öğrenci, durum, transkript, giriş puanı, taban puan, ÖSYM doğrulama, senaryo ucu; 10 senaryo öğrencisi | Uçlar curl ile doğru yanıt veriyor |
| **A4 — Veritabanı** | Prisma şeması (19 tablo), göç, değiştirilemez denetim kaydı tetikleyicisi, kısmi benzersiz indeks, seed (gerçek 2026-27 kontenjanları + kural seti + kullanıcılar) | `db:migrate` ve `db:seed` hatasız |
| **A5 — API çekirdeği** | auth (JWT/JWKS), rol ve kapsam guard'ları, audit interceptor, ObisPort/OsymPort adapter'ları, catalog, calendar, rules, eligibility, applications | Entegrasyon testleri: uygunluk ve başvuru akışı |
| **A6 — API değerlendirme ve karar** | evaluation (sıralama stratejisi), decisions (karar, yayın, CSV/XLSX dışa aktarma), notifications, yedekten çağırma | Entegrasyon testleri: sıralama → karar → yayın |
| **A7 — API takip** | enrollments (yan dal planı, ayrılma, ÇAP'tan yan dala geçiş), monitoring (BullMQ taraması), reports, rule-sets (sürüm, dry-run) | Entegrasyon testleri: tarama bulguları |
| **A8 — Web** | Next.js, Auth.js + Keycloak, tema, düzen (üst menü, alt bilgi), 12 ekran | Rol başına giriş yapılıp ekranlar açılıyor |
| **A9 — Uçtan uca** | Playwright: uygunluk → başvuru → sıralama → karar → yayın → kayıt → tarama → kayıt silme | Senaryo yeşil |
| **A10 — Belgeler** | README (kurulum, deneme kullanıcıları, senaryolar), teknik dokümanı uygulamayla eşitleme | Temiz bir klonda README adımları çalışıyor |

## 3. Bilinçli sadeleştirmeler

- **Açık sorular:** Kurallar şimdilik PRD'deki yorumla kurulur ve parametreli bırakılır. Örneğin `GANO_DROP_STRIKES` için ilk darbe 2.50, ikinci darbe 2.72. Sıralama varsayılanı GNO.
- **Bildirimler:** E-posta Mailpit'e gider, gerçek gönderim yok.
- **OBİS kesin kayıt doğrulaması:** Sahte OBİS'te "kayıt yaptırdı" bayrağı ile yapılır.
- **Dışa aktarma:** CSV ve XLSX var. PDF dışa aktarma yerine yazdırılabilir HTML sayfası var (FR-18 isteğe bağlıydı).

## 4. Kapsam değişikliği (2026-10-08)

Danışman kararıyla proje yalnız Bilgisayar Mühendisliği Bölümünü kapsayacak, öğrenci girişi içerecek ve OBİS'siz çalışacak biçimde yeniden düzenlendi. Yukarıdaki aşamalar ilk kapsamın kaydıdır; güncel kapsam için [KARARLAR.md](KARARLAR.md) K-12 – K-17 ve [TEKNIK-DOKUMAN.md](TEKNIK-DOKUMAN.md) bölüm 18'e bakın. Arayüz teması (bölüm 1) aynen geçerlidir.
