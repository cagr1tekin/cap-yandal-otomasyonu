# Kararlar ve kaynakları

Tarih: 2026-10-07. Her kararın yanında **kesinlik düzeyi** ve **kaynağı** yazılıdır.

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

## Hâlâ açık olanlar (birime sorulacak)

1. Eşit GNO'da ikincil sıralama ölçütü (K-3).
2. %20 başarı sıralamasının hesaplanma yöntemi (K-6).
3. Kesin kayıt belge listesinin birimden birime farkı. Yalnızca İİBF listesi incelendi (K-8).
4. Fakülte esaslarındaki "yalnızca %20" ifadesinin bilinçli bir kısıtlama mı, güncellenmemiş metin mi olduğu (K-7).
