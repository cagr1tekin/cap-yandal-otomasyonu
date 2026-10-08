# Güvenlik: yapılan testler ve alınan önlemler

Çerçeve e-postası: "Sistemde uygun sızma testlerinin yapılmış ve gerekli güvenlik önlemlerinin alınmış olması gereklidir. Bu testleri yalnızca kendi geliştirdiğiniz uygulama üzerinde ve kendi test ortamınızda yapın."

- Bütün testler **yalnızca bu uygulamanın yerel ortamında** (Docker'daki PostgreSQL, Keycloak, Mailpit) çalıştırıldı. Başka bir sisteme istek atılmadı.
- Sistemdeki bütün öğrenci ve personel verisi **sentetiktir** (`packages/seed-data`). Okul e-postaları `@ogrenci.selcuk.test` gibi var olmayan bir alan adındadır; e-postalar dışarı çıkmaz, yerel Mailpit'te kalır.

## Testler

Sızma testleri otomatiktir ve her koşuda tekrarlanır: `apps/api/test/security.spec.ts` (18 test, gerçek HTTP istekleriyle, `cap_takip_test` veritabanında). Yetki ve akış kuralları ayrıca `apps/api/test/flow.spec.ts` (17 test) ve tarayıcıdan `e2e/` (18 Playwright testi) ile denenir.

| Saldırı / zayıflık | Test | Beklenen ve alınan sonuç |
|---|---|---|
| Kimliksiz erişim, sahte belirteç | Belirteçsiz istek, `Basic` kimlik, imzası bozuk belirteç; Keycloak'ta var ama koordinatörün açmadığı hesap | 401; açılmamış hesap 403 |
| Hesap devralma | Aynı kullanıcı adıyla farklı kimlik (`sub`) | 401 |
| Pasif hesap | Koordinatörün pasife aldığı hesapla istek | 403 |
| IDOR (başkasının kaydı) | Öğrenci başka öğrencinin kartına, belgesine, mesajına, notlarına, kontrollerine istek atar | 404: kaydın varlığı bile sızdırılmaz |
| IDOR (kimlik karıştırma) | Kendi numarasıyla başka öğrencinin kayıt kimliğini kullanma | 404 |
| Dikey yetki yükseltme | Öğrenci koordinatör uç noktalarını çağırır (onay, GANO, karar, katalog, kural, hesap) | 403 |
| Salt okunur rol | Bölüm başkanı veri değiştiren her uç noktayı dener | 403 |
| Toplu atama (mass assignment) | İsteğe `status`, `source`, `track` gibi fazladan alan eklemek | Alanlar yok sayılır; öğrencinin kaydı "onay bekliyor" ve kaynağı öğrenci olarak başlar |
| SQL ve yol enjeksiyonu | Aramada `' OR '1'='1` ve `DROP TABLE`, yolda `../` ve `..%2F` | Sorgular parametreli, tablo yerinde; biçim denetimi 400 / 404 |
| XSS | Mesaja `<script>` ve `onerror` yüklü metin | Düz metin saklanır, JSON döner; ön yüz kaçışlar |
| Dosya türü sahteciliği | `.png` uzantılı HTML | Tür içerikten (sihirli bayt) belirlenir, reddedilir |
| Zararlı / bozuk dosya | EICAR imzası, Launch eylemi ya da JavaScript içeren PDF, şifreli PDF, kesik dosya | Reddedilir |
| Dosya adı ve yol | `../../../etc/passwd.pdf` adlı dosya | Ad `passwd.pdf` olarak temizlenir; dosya rastgele adla, depo kökünün içinde saklanır |
| Boyut | Ayardaki sınırın ya da izin verilen türlerin dışındaki dosya | 400 |
| Belge sunumu | İndirilen belgenin yanıt başlıkları | Türü sabit, `nosniff`, `Content-Security-Policy: default-src 'none'`, `no-store` |
| Kaba kuvvet / kötüye kullanım | Dakikada 20'den fazla yükleme | 429 |
| Veri silme | `DELETE` istekleri; sekiz tabloda veritabanından doğrudan `DELETE` | Uç nokta yok (404); tetikleyici reddeder |
| İşlem kaydının değiştirilmesi | Veritabanında işlem kaydını değiştirme ve silme (`flow.spec.ts`) | Tetikleyici reddeder |
| Güvenlik başlıkları | Üretim uygulamasının yanıtları | helmet başlıkları açık |

## Önlemler

**Kimlik ve oturum**
- Keycloak (OpenID Connect, PKCE). Kendi kendine kayıt kapalı; hesabı koordinatör açar, şifreyi kullanıcı e-postadaki 72 saatlik bağlantıyla kendisi belirler.
- Şifre politikası: en az 10 karakter, büyük/küçük harf, rakam, kullanıcı adı ya da e-posta olamaz, son 3 şifre tekrar edilemez. Kaba kuvvet koruması açık.
- API yalnızca RS256 imzalı, doğru yayıncı ve hedef kitleli belirteci kabul eder. Rol ve etkinlik veritabanından okunur; Keycloak'taki rol iddiasına güvenilmez.
- Erişim belirteci 15 dakika, web oturumu en çok 8 saat; çerez `httpOnly`.

**Yetki**
- Her istek: kimlik → hesap etkin mi → rol. Öğrenci için her sorgu kendi öğrenci numarasıyla sınırlanır; başkasının kaydı 404 döner.
- Bölüm başkanı için okuma dışındaki her istek genel koruyucuda reddedilir (tek tek uç noktaya bırakılmaz).
- Onaylanmış kayıt kilitlidir; düzeltme yalnız koordinatörde ve gerekçelidir.

**Girdi**
- Bütün istek gövdeleri Zod şemalarıyla doğrulanır; tanımsız alanlar atılır. Prisma parametreli sorgu kullanır, ham SQL yok.
- Ders yalnız katalogdan seçilir; serbest metin kabul edilmez.

**Dosya**
- İzin verilen türler ayarlardan (varsayılan PDF, JPEG, PNG), boyut ayarlardan (varsayılan 10 MB, sabit üst sınır 20 MB).
- Tür sihirli baytlardan belirlenir; PDF'te etkin içerik ve şifreleme, bütün türlerde kesik dosya ve EICAR denetlenir. SHA-256 özeti saklanır.
- Dosya rastgele adla, web kökünün dışında saklanır; dosya alanları veritabanında değiştirilemez.

**Veri bütünlüğü**
- Bütün tablolarda silmeyi reddeden tetikleyici; işlem kaydı ve mesajlar değiştirilemez.
- Her yazma işlemi işlem kaydına kim, rol, ne zaman, eski ve yeni değerle yazılır.

**Taşıma ve tarayıcı**
- API: helmet, yalnız web kökenine CORS, kullanıcı başına oran sınırı (dakikada 300; yükleme 20, mesaj 30).
- Web: `Content-Security-Policy` (form gönderimi yalnız kendi kökeni ve Keycloak), `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`.

## Kapsam dışı ve üretim için yapılacaklar

- Yerel ortam HTTP'dir; üretimde TLS, HSTS ve güvenli çerez bayrağı açılmalı.
- Keycloak yönetici şifresi ve servis istemcisi sırrı yalnız yerel geliştirme içindir; üretimde sır yöneticisinden gelmeli.
- Gerçek bir virüs tarayıcısı (ör. ClamAV) yerine yalnızca yapısal denetim ve EICAR imzası vardır.
- Yedekleme ve kişisel veri saklama süresi (KVKK) kurumla belirlenmeli.
