# Kararlar ve kaynakları

Tarih: 2026-10-07; kapsam değişikliği 2026-10-08 (K-12 ve sonrası; K-1, K-5, K-6, K-8, K-9, K-10 yerine geçer). Her kararın yanında **kesinlik düzeyi** ve **kaynağı** yazılıdır.

| Düzey | Anlamı |
|---|---|
| **Kesin** | Mevzuat ya da resmî belge açıkça söylüyor. |
| **Uygulama** | Mevzuatta yok; üniversitenin yayımladığı belgelerde fiilen böyle yapılıyor. Kanıtın kapsamı belirtilmiştir. |
| **Açık** | Kaynak bulunamadı. Sistemde ayarlanabilir bırakıldı, birime sorulmalı. |

Kaynak dosyaları: `kaynaklar/` ve `kaynaklar/mevcut-surec/`.

## K-1 Kapsam: rol bazlı personel paneli

**Karar:** Proje, öğrencinin değil personelin kullandığı rol bazlı yönetim panelidir. Öğrenci başvurusu bugünkü gibi kâğıt dilekçeyle birime gelir; birim öğrenci işleri başvuruyu panele girer. Öğrenciye bildirimler e-postayla gider. Öğrenci ekranları kapsam dışıdır (kodda "ileride" olarak kalabilir).

**Dayanak:** Hocanın "yalnızca admin panel" isteği; başvuruların birime şahsen yapılması (ÖİDB 2026 duyurusu, Esaslar m.1).

**Roller ve yetkileri** (her rol kaynaktaki görevine bağlıdır):

| Rol | Panelde yaptığı | Kaynak |
|---|---|---|
| ÖİDB | Kural setleri, dönemler, programlar, kullanıcılar ve roller, tüm birim raporları, kontenjan listesinin derlenmesi | ÖİDB 31/7/2026 duyurusu (kontenjan ve koordinatör PDF'i) |
| Birim öğrenci işleri | Takvim; başvuru girişi ve belge kontrolü; yönetim kurulu karar kaydı; sonuç ilanı; kesin kayıt; dönemlik ders kaydı formlarının teslim alınması ve OBİS'e girilecek liste; kayıt silme kararının işlenmesi | Esaslar m.1, m.4; Yönerge m.5/g; İİBF kayıt duyurusu |
| Bölüm başkanı | Program açma ve kontenjan önerisi; koordinatör atama; protokol ve ders kayıt formu onayı (ana dal ve ÇAP bölüm başkanı ayrı ayrı) | Yönerge m.4, m.5/a, m.6; Esaslar m.3–4 |
| Koordinatör | Başvuruların değerlendirmesi ve sıralama önerisi (bölüm kurulu adına); protokol ve ders kayıt formunun hazırlanması; formları öğrenci işlerine toplu teslim; kayıtlı öğrenci takibi | Yönerge m.6; Esaslar m.3–4 |
| Ana dal danışmanı | Protokol ve dönemlik ders kayıt formunda onay; öğrencisini izleme | Esaslar m.3–4; Danışmanlık Yön. m.7 |
| ÇAP/yan dal danışmanı | ÇAP/yan dal programında ayrıca atanan danışman | Danışmanlık Yön. m.6/5 ("her program için ayrı danışman atanır") |

## K-2 AS-1: Ana dal GNO düşüşünde kayıt silme — **Kesin**

YÖK Geçiş Yönetmeliği m.17/4: "Tüm çift anadal öğrenimi süresince öğrencinin anadal programındaki genel not ortalaması bir defaya mahsus olmak üzere 100 üzerinden 65'e kadar düşebilir. Anadal programındaki genel not ortalaması ikinci kez 100 üzerinden 70'in altına düşen öğrencinin ikinci anadal diploma programından kaydı silinir." Selçuk ÇAP Yönergesi m.9/e bunu 4'lük sistemde 2,50 ve 2,72 olarak yazar.

Kural (dönem sonu ana dal GNO'su, 4'lük):

| Durum | Sonuç |
|---|---|
| GNO ≥ 2,72 | Sorun yok |
| 2,50 ≤ GNO < 2,72, ilk kez | İzin kullanılır (uyarı, sayaç +1) |
| GNO < 2,72, ikinci kez | Kayıt silme adayı |
| GNO < 2,50 (ilk kez bile) | Kayıt silme adayı: izin yalnızca 2,50'ye kadar |

Sistemdeki ilk uygulama 2,50 alt sınırını atlıyordu; düzeltildi (KR-ÇAP-11, `floor: 2.5`).

## K-3 AS-2: Kontenjandan fazla başvuruda sıralama — **Uygulama** (yetki: **Kesin**)

- **Kesin:** Mevzuat (YÖK m.17, Yönerge m.5, Esaslar m.2) sıralama ölçütü koymaz. ÇAP'ta değerlendirmeyi bölüm kurulu yapar, kabul yönetim kurulu kararıyla kesinleşir. Yan dalda başvuruları yönetim kurulu değerlendirir (YÖK m.18/4).
- **Uygulama:** İİBF 2023-24 güz sonuç listelerinin beşinde de (İşletme, İktisat, Uluslararası İlişkiler, Uluslararası Ticaret ve Finansman, Siyaset Bilimi ve Kamu Yönetimi; ÇAP ve yan dal) asil ve yedekler GNO'ya göre azalan sıralanmış. Örneğin Uluslararası İlişkiler'de son asil 2,91, ilk yedek 2,88.
- **Karar:** Varsayılan sıralama GNO'ya göre azalan. Kurul öneriyi gerekçe yazarak değiştirebilir (zaten var, denetim kaydına yazılıyor).
- **Açık:** Eşit GNO'da neye bakıldığı. Listelerde iki 3,38 alt alta, ölçüt yazmıyor. İkincil ölçüt (sınıf sırası, başvuru zamanı) ayarlanabilir kalır.

## K-4 AS-3: Birden fazla programa başvuru — **Kesin**

Esaslar m.1: "Öğrenciler birden fazla çift anadal programına başvurabilirler." Yan dal esasları da aynı. Aynı anda iki ÇAP'a **kayıt** olunamaz (YÖK m.16/3, Yönerge m.5/ğ). ÇAP ve yan dal farklı programlarda birlikte yapılabilir. Sistemdeki davranış buna uygun.

## K-5 AS-4: OBİS'in rolü — **Kesin**

- OBİS'te başvuru modülü yok; başvuru birime şahsen (ÖİDB 2026 duyurusu).
- ÇAP/yan dal ders kaydı OBİS'e öğrenci işleri tarafından, koordinatörün toplu teslim ettiği kâğıt formlardan girilir. Bu her dönem tekrarlanır (Esaslar m.4).
- Danışman ataması OBİS'e öğrenci işlerince işlenir (Danışmanlık Yön. m.6/1).
- **Karar:** Panel OBİS'e yazmaz. Öğrenci işlerinin OBİS'e gireceği listeyi üretir (dışa aktarma).

## K-6 AS-5: %20 başarı sıralaması

- **Kesin:** Belgeyi öğrencinin birim öğrenci işleri düzenler (Esaslar m.1). ÖİDB'ye göre öğrenci belgesi ya da transkript üzerinde belirtilebilir (2026 duyurusu).
- **Açık:** Hesaplama yöntemi (sınıf, kohort, tarih). Bulunamadı. Panelde değer OBİS'ten okunuyormuş gibi alınır; belge kontrol listesinde "%20 belgesi" ayrı bir madde olarak tutulur.

## K-7 Başvuru koşullarındaki çelişki (taban puan yolu) — **Kesin: yönerge geçerli**

- YÖK m.17/2-c ve Selçuk Yönergesi m.5/1-d: %20'de olmayan ama YKS puanı taban puanın üstünde olan öğrenci de başvurabilir.
- Fakültelerin dağıttığı "Uygulama Esasları" metni (2020'den beri) yalnızca %20'yi yazıyor. Eğitim Fakültesi 2025 duyurusu da öyle.
- **Karar:** Üst mevzuat (YÖK yönetmeliği ve senato yönergesi) esaslardan önce gelir; sistem taban puan yolunu kabul eder. Esaslar ile yönerge arasındaki fark raporda bulgu olarak belirtilir.

## K-8 Kesin kayıt — **Kesin (İİBF örneği)**

İİBF 2023-24: kayıt **şahsen**. İstenenler: dilekçe, nüfus cüzdanı fotokopisi, öğrenci kimlik fotokopisi, yeni tarihli öğrenci belgesi ve transkript, 3 fotoğraf, ana dal ders planı (2 adet), yönerge çıktısı. Asil ve yedek için ayrı son gün; yedek liste ayrıca ilan ediliyor. Kayıttan sonra kabul ve ders protokolü ile ders kayıt formu, imzaları tamamlanmış olarak öğrenci işlerine teslim ediliyor.

**Karar:** "OBİS'te kesin kayıt" modeli kaldırılır. Yerine birim öğrenci işlerinin kesin kaydı **belge kontrol listesiyle** sisteme işlemesi gelir. Belge listesi birim bazında tanımlanabilir.

## K-9 Kabul ve Ders Protokolü — **Kesin**

Esaslar m.3 ve form: ders kodu, adı ve kredisi listesi; imzacılar öğrenci, ana dal danışmanı, ana dal bölüm başkanı, ÇAP/yan dal koordinatörü, ÇAP/yan dal bölüm başkanı. ÇAP için 240 AKTS (ortak dersler dahil), yan dal için 30 AKTS ve en az 6 ders. Değişiklik yalnızca tüm imzacıların onayıyla. İİBF ilkeleri: "imza ve tarih eksik evrak işleme alınmaz", "ana daldaki aynı ders alınamaz", protokol "dersin programdan kalkması" gibi zorunlu haller dışında değişmez.

**Karar:** Panelde protokol, beş onaylı bir iş akışıdır. Öğrenci kâğıda imza atar; öğrenci işleri imzalı kâğıdın alındığını işaretler.

## K-10 Dönemlik ders kayıt formu — **Kesin**

Esaslar m.4 ve form: her dönem doldurulur; danışman ve koordinatör imzalar, iki bölüm başkanı onaylar; koordinatör toplu teslim eder; öğrenci işleri OBİS'e girer. İİBF ilkeleri: her dönem "yeni tarihli not durum belgesi" istenir; Erasmus/Farabi dönemi ÇAP/yan dal ders kaydı yapılamaz ve dilekçeyle bildirilir.

**Karar:** Panelde dönemlik ders kaydı ekranı ve onay akışı olacak. Çıktısı OBİS'e girilecek toplu liste. Erasmus/Farabi dönemi için "dönem izni" kaydı.

## K-11 Yan dal kuralları — **Kesin**

YÖK m.19–20 ile Selçuk Yan Dal Yönergesi uyumlu: 3.–6. yarıyıl, başvuruda GNO ≥ 65/100 (Selçuk: 2,50), devam için ana dal GNO ≥ 60/100 (Selçuk: 2,30), ana daldan mezun olup bitiremeyene en çok 2 yarıyıl ek süre. Sistemdeki kurallar değişmeden kalır.

## K-12 Kapsam değişikliği (8/10/2026): yalnız Bilgisayar Mühendisliği, öğrenci girişi, OBİS'siz — **Kesin (danışman kararı)**

Danışman hocanın 8/10/2026 toplantısındaki kararları ve sistemdeki karşılıkları. Bu madde **K-1, K-5, K-6, K-8, K-9 ve K-10'un yerine geçer**; o maddeler önceki kapsamın kaydı olarak durur.

| Hocanın kararı | Sistemdeki karşılığı |
|---|---|
| Yalnız bizim bölüm (Bilgisayar Mühendisliği) | Tek hedef program. Birim ve çok programlı yapı kaldırıldı. Diğer bölümler yalnızca öğrencinin **ana dal bölümü** olarak tanımlı (EEM, Makine, Mekatronik, Metalurji ve Malzeme). |
| Öğrenci girişi olacak | Öğrenci hesabını kendisi açar, başvurusunu çevrim içi yapar, formlarını imzalar. Personel rolü olmayan her hesap öğrenci hesabıdır. |
| Bilgilerini öğrenci kendi girecek | "Bilgilerim": öğrenci no, ana dal, yarıyıl, GNO, sınıf sırası ve mevcudu, YKS puanı ve başarı sırası. Başvuru, verildiği andaki beyanı saklar. |
| OBİS API'si yok, biz dolduracağız | Sahte OBİS uygulaması ve OBİS arayüzü silindi. Müfredat, protokoller ve taban puan tablosu sistemde tutulur; notları komisyon, dönem sonu GNO'sunu öğrenci girer. |
| Öğrenci İşleri Daire Başkanlığı ve birim öğrenci işleri yok | İki rol kaldırıldı; görevleri aşağıdaki gibi dağıtıldı. |
| İlgili sitede belgeler var | Bölümün "Çift Anadal" sayfasındaki altı belge indirildi (`kaynaklar/bolum-sitesi/`), sistemin verisi ve formları bunlardan kuruldu. |

**Roller** (dört rol):

| Rol | Yaptığı | Kaynak |
|---|---|---|
| Öğrenci | Bilgi ve belge girişi, başvuru, kesin kayıt onayı, protokol imzası, ders kayıt formu, muafiyet başvurusu, dönem sonu beyanı, ayrılma | Rehber 2025: formları "öğrenci hazırlar" |
| Koordinatör (ÇAP komisyonu) | Kontenjan ve takvim, beyan doğrulama, sıralama, kurul kararının kaydı ve ilan, protokol şablonları ve protokol, imza, not girişi, tarama ve bulgu kararı, izin, kural setleri | ÇAP Yön. m.6; bölüm sitesinde üç kişilik komisyon |
| Bölüm başkanı (Bilgisayar Müh.) | Protokolde "çift anadal bölüm başkanı" imzası; kullanıcı ve rol yönetimi; denetim kaydı ve raporlar | ÇAP Yön. m.6: koordinatörü bölüm başkanı atar |
| Ana dal imzacıları (danışman, ana dal bölüm başkanı) | Yalnızca kendi bölümünün öğrencilerini görür ve formlarını imzalar | Protokol ve FORM01 imza kutuları |

**Kaldırılan rollerin görevleri nereye gitti:**

| Eski görev (rol) | Yeni sahibi |
|---|---|
| Başvuru girişi ve belge kontrolü (birim) | Öğrenci başvurur ve belge yükler; koordinatör beyanı belgeyle doğrular |
| Takvim, kurul kararı kaydı, sonuç ilanı (birim) | Koordinatör. Kararı fakülte yönetim kurulu alır; sisteme sayısı ve tarihi girilir |
| Kesin kayıt (birim) | Öğrenci kaydını kendisi onaylar; süre dolunca koordinatör dönemi kapatır, yedekler çağrılır |
| Protokol dosyalama, OBİS'e ders girişi (birim) | Kaldırıldı. Formlar yazdırılabilir; resmî ders kaydı OBİS'te kalır |
| Tarama ve bulgu kararı, izin (birim) | Koordinatör |
| Kural setleri (ÖİDB) | Koordinatör |
| Kullanıcı ve rol yönetimi, denetim kaydı (ÖİDB) | Bilgisayar Mühendisliği bölüm başkanı (denetim kaydını koordinatör de görür) |

## K-13 Öğrencinin kendi girdiği veriye güven — **Karar (tasarım)**

OBİS olmadığı için akademik bilginin tek kaynağı öğrencinin beyanıdır. Beyan şu dört denetimle kullanılır:

1. Başvuruda belge yüklenir; dosyanın içeriği (PDF/JPG/PNG) sunucuda denetlenir, özeti (SHA-256) saklanır.
2. Koordinatör her başvuruda beyanı belgeyle karşılaştırır: **doğrulandı** ya da **uyuşmuyor** (gerekçeli). Uyuşmayan başvuru değerlendirme dışı kalır.
3. Doğrulanmamış başvuru varken **sıralama kilitlenemez**.
4. Dönem sonu taramasında, doğrulanmamış GNO beyanına dayanan bulgu **onaylanamaz**; beyan girilmemişse GNO kuralı çalışmaz, "veri eksik" bulgusu yazılır.

Fakülte içi öğrencide transkript ve ilk %20 belgesi istenmez (Rehber, "Başvuru"); bu durumda koordinatör değerleri fakülte öğrenci işlerinden teyit eder ve notuna yazar.

## K-14 Başvuru belgeleri — **Kesin (Rehber 2025)**

Rehber, "Başvuru": dilekçe; transkript ve ilk %20 belgesi (fakülte içi bölümlerde gerekmez); kayıt yılındaki YÖK başarı sıralaması ve puan belgesi. Sistemde dilekçe çevrim içi başvurudan üretilir. ÇAP'ta YKS belgesi her zaman, transkript ve %20 belgesi yalnız fakülte dışından gelenlerde zorunludur. Yan dalda transkript zorunludur (Yan Dal Uygulama Esasları m.1). K-8'deki İİBF kesin kayıt belge listesi kapsam dışıdır.

## K-15 Protokol, ders kayıt formu ve muafiyet formu — **Kesin (bölüm belgeleri)**

| Form | İmzacılar | Nüsha | Kaynak |
|---|---|---|---|
| Kabul ve Ders Protokolü | Öğrenci, ana dal danışmanı, ana dal bölüm başkanı, koordinatör, çift anadal bölüm başkanı | 4 | Protokol belgeleri; Rehber |
| Ders Kayıt Formu (FORM01) | Öğrenci, ana dal danışmanı, koordinatör | 3 | FORM01; Rehber |
| Özel Şartlı Derslerin Muafiyeti Formu | Öğrenci, ana dal danışmanı, koordinatör | 2 | Rehber, "Özel şartlı derslerin muafiyeti" |

- **Protokol bölümler arasıdır**, öğrenciye özel hazırlanmaz: sitede "Elektrik-Elektronikten Bilgisayara" (135 AKTS, 8 özel şart) ve "Makineden Bilgisayara" (171 AKTS, 2 özel şart) protokolleri var. Sistemde bunlar şablondur; öğrencinin protokolü şablondan üretilir. K-9'daki "koordinatör dersleri tek tek seçer" modeli kaldırıldı.
- Protokolde **teknik seçmeli ders yerleri** vardır ("5. Yarıyıl Teknik Seçmeli Ders"). Öğrenci, dersi ders kayıt formunda o yarıyılın seçmelilerinden seçer.
- **Ortak dersler protokole yazılmaz** (Rehber). 240 AKTS koşulu (ÇAP Yön. m.7/2) protokol + ortak AKTS ile sağlanır: EEM 135 + 105, Makine 171 + 69. Ortak AKTS, 240'tan protokol toplamı çıkarılarak bulunmuştur; belgede ayrıca yazmaz.
- K-10'daki "iki bölüm başkanı da onaylar" ifadesi fakülte esaslarından geliyordu; bölümün kendi formunda (FORM01) üç imza vardır. **Bölüm belgesi esas alındı.**
- Özel şartın karşılığı protokolde bir ders ise o ders, bir teknik seçmeli ise aynı yarıyılın boş seçmeli yeri muaf sayılır.
- İmzacının hesabı yoksa imza satırı boş atanır ve ıslak imzayı koordinatör işler; denetim kaydına koordinatörün adıyla yazılır.

## K-16 Gerçek ve temsilî veriler

| Veri | Durum | Kaynak |
|---|---|---|
| Müfredat (118 ders: kod, ad, AKTS, yarıyıl) | **Gerçek** | Bologna ders paketi, 8/10/2026 |
| İki ÇAP protokolü ve özel şartları | **Gerçek** | Bölüm sitesi, 4/6/2026 tarihli belgeler |
| Kaynak bölüm kısıtı (2026-27 güz: yalnız EEM) | **Gerçek** | ÖİDB kontenjan ilanı, dipnot 1 |
| Kontenjan sayıları | Temsilî | İlan tablosu metne bozuk aktarıldı |
| Taban puanlar | Temsilî | YÖK Atlas'tan alınamadı; koordinatör panelden girer |
| Başarı sırası şartı (300.000) | Doğrulanmalı | Mühendislik programları için genel şart; tablo düzenlenebilir |
| Yan dal ders havuzu | Temsilî | Bölümün yayımlanmış yan dal listesi bulunamadı |
| Öğrenciler ve personel adları | Uydurma | Gerçek kişi adı kullanılmaz |

## K-17 Kapsam dışı kalanlar

- Bilgisayar Mühendisliği öğrencisinin **başka bölümde** yaptığı ÇAP / yan dal (o bölümün sistemi olurdu).
- Yetenek sınavı kuralı (KR-ÇAP-07): bölümde yok; kural setinden çıkarıldı, değerlendiricisi pakette duruyor.
- "Ana dal dersi protokole yazılamaz" denetimi (KR-ÇAP-19, KR-YD-13): ana dal müfredatı sistemde tutulmuyor; protokol zaten bölümler arası belgede sabit.
- İmzalanmış protokolün değiştirilmesi (şablon değişikliği yalnız yeni protokolleri etkiler).

## Hâlâ açık olanlar (hocaya ve komisyona sorulacak)

1. Eşit GNO'da ikincil sıralama ölçütü (K-3).
2. Bilgisayar Mühendisliğinin gerçek taban puanları ve kontenjanları (K-16).
3. Bölümün yan dal programı ve ders havuzu var mı (K-16).
4. Ana dal danışmanı ve ana dal bölüm başkanı sisteme hesapla mı girecek, yoksa imzaları hep ıslak imza olarak mı işlenecek (K-15).
5. Fakülte içi öğrencide GNO ve sıra teyidi nasıl yapılacak (K-13).
