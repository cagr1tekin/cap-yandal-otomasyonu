# PRD — Çift Ana Dal ve Yan Dal Başvuru ve Takip Sistemi

| | |
|---|---|
| Kurum | Selçuk Üniversitesi |
| Proje türü | Bitirme projesi |
| Sürüm | 0.1 (taslak) |
| Tarih | 2026-10-07 |
| Kaynaklar | `kaynaklar/` klasörü, dizin: [KAYNAKLAR.md](../kaynaklar/KAYNAKLAR.md) |

Bu belge sistemin **ne** yapacağını ve **neden** yapacağını tanımlar. **Nasıl** yapılacağı (mimari, veri modeli, API) teknik dokümanda yazılacak.

---

## 1. Özet

Selçuk Üniversitesi'nde çift ana dal (ÇAP) ve yan dal başvuruları 2026-2027 güz yarıyılında hâlâ kâğıt evrakla, birime şahsen teslim edilerek yapılıyor. Uygunluk koşulları (GNO, başarı sıralaması, dönem penceresi, kaynak bölüm kısıtı) öğrenci tarafından elle kontrol ediliyor. Bölüm sayfalarında da yürürlükteki yönergeyle çelişen eski bilgiler bulunuyor.

Bu sistem başvurudan sertifika veya diploma hakkına kadar **ÇAP ve yan dala özgü iş akışını** dijitalleştirir. Kuralları yönergelerden alınmış tek bir kural motorunda toplar. Not, ders kaydı, belge, harç ve diploma basımı gibi **zaten başka bir sistemde yapılan işleri yeniden yapmaz**: o sistemlerden veri okur ya da kullanıcıyı oraya yönlendirir.

## 2. Problem

### 2.1 Mevcut durum
Kaynak: 31/7/2026 tarihli Öğrenci İşleri duyurusu ve ÇAP Yönergesi m.5.

1. Rektörlük, kontenjan ve koordinatörleri yarıyıl başlamadan 15 gün önce **PDF olarak** duyurur.
2. Öğrenci şu belgeleri toplar: öğrenci belgesi, transkript, ilk %20'de olduğunu gösteren belge (gerekirse YKS sonuç belgesi) ve başvuru formu.
3. Başvurular ilgili birime **şahsen** yapılır.
4. Bölüm önerisini verir, birim yönetim kurulu karar verir.
5. Sonuçlar **birimin web sitesinde** ilan edilir.
6. Kabul edilen öğrenci kayıt döneminde iki programa da kayıt yaptırır.
7. Kayıttan sonra GNO düşüşü, iki dönem ders almama ve ek süre gibi takipler elle ya da dağınık şekilde yürütülür.

### 2.2 Sancı noktaları

| Kim | Sorun |
|---|---|
| Öğrenci | Uygun olup olmadığını bilmeden belge toplar ve birime gider. Başvurduğu programın kendi bölümünden öğrenci kabul edip etmediğini dipnotlardan çıkarması gerekir (ör. Teknoloji Fakültesi programları). Bölüm sayfalarındaki bilgi eski olabilir: ÇAP için GNO 3.00 yazıyor, yönerge 2.75 diyor. Başvurusunun durumunu göremez. |
| Bölüm / koordinatör | Kâğıt dosyaları elle inceler, GNO'yu ve %20 sıralamasını belgeden doğrular, sıralama tablosunu elle hazırlar. |
| Birim öğrenci işleri | Yönetim kurulu gündemi ve sonuç listesi elle hazırlanır, dönem sonu kayıt silme koşulları elle izlenir. |
| Öğrenci İşleri Daire Başkanlığı | Birimlerdeki ÇAP ve yan dal durumunu birleşik olarak göremez, kontenjan kullanımını izleyemez. |

### 2.3 Etki
- Uygun olmayan başvurular yapılıyor ve iş yükü boşa gidiyor.
- Kural uygulamasında birimler arasında tutarsızlık ve hata riski var.
- Kayıt silme koşulları (ör. ana dal GNO'sunun ikinci kez eşiğin altına düşmesi) gözden kaçabiliyor.

## 3. Hedefler ve kapsam

### 3.1 Hedefler
- **H1:** ÇAP ve yan dal başvurusunu tamamen çevrimiçi yapmak. Öğrencinin başvuru için birime gitmesi gerekmez.
- **H2:** Uygunluğu başvurudan **önce**, gerekçesiyle ve yönerge maddesine atıfla göstermek.
- **H3:** Değerlendirme, sıralama ve kurul kararı akışını izlenebilir hâle getirmek.
- **H4:** Kayıttan sonraki kural takibini dönem sonlarında otomatik yapmak ve uyarı üretmek.
- **H5:** Kuralları tek bir yerde, sürümlü ve yapılandırılabilir tutmak. Yönerge değişince kod değil kural tanımı güncellenir.

### 3.2 Kapsam ilkesi: var olan sistemin işi burada yapılmaz

| İş | Sahibi sistem | Bu sistemin rolü |
|---|---|---|
| Notlar, GANO, YANO, transkript, sınıf ve dönem bilgisi | OBİS | **Okur** (bu projede sahte OBİS servisi) |
| Ders kaydı, ekle-bırak, danışman ders onayı | OBİS | **Yönlendirir**. Yan dal ders planı için yalnızca plan onayını tutar, kayıt OBİS'te yapılır |
| Öğrenci belgesi, transkript belgesi | e-Devlet / OBİS | **İstemez**. Aynı veriyi OBİS'ten doğrudan okur |
| YKS sonuç belgesi | ÖSYM / e-Devlet | Belge numarası ve doğrulama kodunu alır, doğrulamayı ÖSYM'ye yönlendirir |
| İki programa kesin kayıt | OBİS (birim öğrenci işleri) | Kabul listesini dışa aktarır, kesin kayıt OBİS'te yapılır |
| Katkı payı ve ikinci öğretim ücreti | OBİS / banka | Yönlendirir |
| Yönetim kurulu kararının resmî yazısı | EBYS | Karar tarihini, sayısını ve sonucunu kaydeder. Belgenin aslı EBYS'de kalır |
| Muafiyet ve intibak başvurusu (dilekçe) | Birim / OBİS | Kapsam dışı. ÇAP veya yan daldan ayrılınca derslerin ana dala sayılması için birime yönlendirir |
| Diploma ve sertifika basımı | OBİS / Öğrenci İşleri | "Hak kazandı" durumunu üretir, basım için yönlendirir |
| Kimlik doğrulama | Üniversite kimlik sistemi (OBİS girişi / SSO) | Kendi şifresini tutmaz. Bu projede sahte SSO kullanılır |
| Genel duyuru yayını | Üniversite ve birim web siteleri | Kontenjan ve sonuç listesini yayımlanabilir çıktı olarak üretir, öğrenci kendi sonucunu sistemde görür |

> **Doğrulanacak varsayım (A1):** OBİS'te ÇAP veya yan dal başvuru modülü yok. 2026-27 duyurusunun "şahsen başvuru" demesi bunu destekliyor, ama Öğrenci İşleri'ne sorulmalı. Varsa bu sistemin kapsamı yalnızca kural takibine daralır.

### 3.3 Kapsam içi
1. Program, kontenjan, koordinatör ve **kaynak bölüm kısıtı** tanımı
2. Birim bazlı başvuru takvimi
3. Uygunluk kontrolü (kural motoru)
4. Çevrimiçi başvuru ve başvuru takibi
5. Değerlendirme, sıralama, bölüm önerisi ve yönetim kurulu karar kaydı
6. Sonuç bildirimi, kabul listesi ve yedek yönetimi
7. Yan dal ders planı (en az 30 AKTS, en az 6 ders) ve koordinatör onayı
8. Dönem sonu kural takibi ve uyarılar
9. Programdan ayrılma talebi ve ÇAP'tan yan dala geçiş değerlendirmesi
10. Mezuniyet ve sertifika uygunluk özeti
11. Raporlama ve denetim kaydı

### 3.4 Kapsam dışı
- Not girişi, ders kaydı, harç, diploma basımı (bkz. 3.2)
- Lisansüstü programlar
- Kurumlar arası kredi transferi ve yatay geçiş
- Gerçek OBİS, e-Devlet, ÖSYM ve EBYS entegrasyonu. Bu projede bağdaştırıcı (adapter) arayüzü ve sahte servisler yazılır.

## 4. Kullanıcılar ve roller

| Rol | Ne yapar |
|---|---|
| Öğrenci | Uygunluğunu görür, başvurur, durumunu izler, yan dal ders planı önerir, ayrılma talebi verir |
| ÇAP / yan dal koordinatörü | Başvuruları inceler, sıralamayı onaylar, bölüm önerisini hazırlar, yan dal planını onaylar, kayıtlı öğrencileri izler |
| Ana dal danışmanı | Öğrencisinin ÇAP ve yan dal durumunu ve uyarılarını görür (yalnızca okur) |
| Bölüm başkanı | Programı açma önerisini ve kontenjan önerisini girer, koordinatör atar |
| Birim öğrenci işleri | Takvimi yönetir, yönetim kurulu kararını kaydeder, sonuçları yayımlar, kabul listesini dışa aktarır |
| Öğrenci İşleri Daire Başkanlığı (ÖİDB) | Kural setini ve sürümlerini yönetir, tüm birimlerin raporlarını görür |
| Sistem yöneticisi | Kullanıcı-rol eşlemesi, entegrasyon ayarları |

## 5. Kural seti (yönergelerden)

Kural motorunun ilk sürümü bu tabloyla başlar. Her kural bir kimlik, kaynak madde ve parametre taşır. Eşik değerleri koda gömülmez, kural tanımında tutulur.

### 5.1 ÇAP — başvuru (ÇAP Yön. m.5)

| Kimlik | Kural | Parametre |
|---|---|---|
| KR-ÇAP-01 | Başvuru dönemine kadarki ana dal derslerinin tamamı alınmış ve geçilmiş olmalı | — |
| KR-ÇAP-02 | Başvuru dönemindeki GNO en az eşik değerinde olmalı | 2.75 |
| KR-ÇAP-03 | (Sınıfında başarı sıralamasında ilk %20'de olmalı) **veya** (YKS puanı hedef programın o yılki taban puanından düşük olmamalı) | %20 |
| KR-ÇAP-04 | Başarı sıralaması şartı olan programlarda, kayıt yılındaki YÖK sıralama şartı da sağlanmalı | Programa göre |
| KR-ÇAP-05 | Dönem penceresi | Ön lisans 2.–3. yy; 4 yıllık lisans 3.–5. yy; 5 yıllık 3.–7. yy; 6 yıllık 3.–9. yy (her biri yarıyıl başında) |
| KR-ÇAP-06 | Aynı anda en fazla bir ÇAP. Aynı programda hem ÇAP hem yan dal yapılamaz | — |
| KR-ÇAP-07 | Yetenek sınavıyla öğrenci alan programda yetenek sınavını geçmiş olmalı | Programa göre |
| KR-ÇAP-08 | Kaynak bölüm kısıtı: program yalnızca listelenen bölümlerden öğrenci kabul edebilir (2026-27 kontenjan listesindeki dipnotlar) | Programa göre liste |
| KR-ÇAP-09 | Kontenjan, programın 1. sınıf 1. dönem mevcudunun en az %20'si olmalı (Hukuk, Tıp, Sağlık ve Mühendislik hariç). Kontenjan girilirken uyarı verilir | %20 |

### 5.2 ÇAP — sürdürme ve mezuniyet (ÇAP Yön. m.7–9)

| Kimlik | Kural | Parametre |
|---|---|---|
| KR-ÇAP-10 | Mazeretsiz üst üste iki dönem ÇAP'tan ders almayan öğrencinin kaydı silinir | 2 dönem |
| KR-ÇAP-11 | Ana dal GNO'su yarıyıl sonunda bir defa 2.50'nin altına düşebilir; ikinci kez 2.72'nin altına düşerse kaydı silinir (**uygulaması doğrulanacak, bkz. AS-1**) | 2.50 / 2.72 |
| KR-ÇAP-12 | Ana dalda kaydı dondurulan öğrencinin ÇAP kaydı da dondurulmuş sayılır | — |
| KR-ÇAP-13 | Diploma hakkı: ana daldan en az 2.72 GNO ile mezuniyet, ÇAP'ın tamamlanması ve her program için 240 AKTS (ön lisans 120) | 2.72 / 240 / 120 |
| KR-ÇAP-14 | Ana dal diploması olmadan ÇAP diploması verilmez | — |
| KR-ÇAP-15 | Ana daldan mezun olup ÇAP'ı bitirmeyen öğrenci için azami süre ÇAP'a kayıt yılından itibaren hesaplanır (2547 s. K. m.44/c) | — |
| KR-ÇAP-16 | Ana dal ve ÇAP bitirme çalışmaları ayrı ayrı yapılmalı | — |
| KR-ÇAP-17 | ÇAP'tan ayrılan öğrencinin aldığı dersler, aynı programın yan dal gereklerini karşılıyorsa yan dal sertifikası hakkı doğar. Karşılamıyorsa dönemine bakılmaksızın yan dala kayıt hakkı doğar | — |

### 5.3 Yan dal (Yan Dal Yön. m.5–7)

| Kimlik | Kural | Parametre |
|---|---|---|
| KR-YD-01 | Başvuru dönemine kadarki tüm dersler alınmış ve geçilmiş olmalı | — |
| KR-YD-02 | GNO en az eşik değerinde olmalı | 2.50 |
| KR-YD-03 | Dönem penceresi: ana dalın 3. ile 6. döneminin başı arası | 3–6 |
| KR-YD-04 | Aynı anda en fazla bir yan dal | 1 |
| KR-YD-05 | Ders havuzu en az 60 AKTS olmalı. Öğrencinin planı en az 30 AKTS ve en az 6 ders içermeli | 60 / 30 / 6 |
| KR-YD-06 | Ana dal GNO'su yarıyıl sonunda eşiğin altına düşerse kaydı silinir | 2.30 |
| KR-YD-07 | Yan dal ortalaması üst üste iki dönem 2.00'ın altında kalırsa kaydı silinir | 2.00 / 2 dönem |
| KR-YD-08 | İzinsiz üst üste iki dönem ders almayan öğrencinin kaydı silinir | 2 dönem |
| KR-YD-09 | Kaydı silinen öğrenci aynı yan dala yeniden kayıt olamaz | — |
| KR-YD-10 | Sertifika: ana daldan mezuniyet ve yan dalı en az 2.00 ortalamayla bitirmek | 2.00 |
| KR-YD-11 | Ana daldan mezun olup yan dalı bitirmeyen öğrenciye en fazla 2 yarıyıl ek süre verilir | 2 yy |

### 5.4 Ortak — not sistemi (Önlisans-Lisans Yönetmeliği m.13–15)
- Harf notu katsayıları: AA 4.00, BA 3.50, BB 3.00, CB 2.50, CC 2.00, DC 1.50, FF ve F 0.00. G, K ve M ortalamaya katılmaz.
- DC notu, o dönemin YANO'su en az 2.50 ise geçer sayılır.
- GANO hesabında tekrar edilen dersin son notu kullanılır. Sonuç virgülden sonra iki haneye yuvarlanır (üçüncü hane 5 ve üzeriyse yukarı).
- ÇAP ve yan dal derslerinin ortalaması ana dal ortalamasından ayrı tutulur. ÇAP ve yan dal için ayrı not belgesi düzenlenir.

> Bu hesaplar OBİS'in işidir. Sistem bunları **yeniden hesaplamaz**, OBİS'ten okur. Tablo sahte OBİS servisinin doğru veri üretmesi ve test senaryoları için buradadır.

## 6. Kullanıcı hikâyeleri ve kabul ölçütleri

### Öğrenci
- **US-01 — Uygunluk görme.** Öğrenci olarak açık ÇAP ve yan dal programlarını ve her birine uygun olup olmadığımı görmek istiyorum. Böylece boşuna başvurmam.
  - Her program için Uygun / Uygun değil / Koşullu durumu gösterilir.
  - "Uygun değil" durumunda sağlanmayan her kural, kural kimliği, yönerge maddesi, öğrencinin değeri ve eşik değeri ile listelenir. Örnek: "GNO 2.61 < 2.75 — ÇAP Yön. m.5/d".
  - Kaynak bölüm kısıtı nedeniyle uygun olunmayan programlar da gerekçesiyle gösterilir.
  - "Koşullu" durumu: %20 şartı sağlanmıyor ama YKS taban puanı yolu açık; öğrenciden YKS belge bilgisi istenir.
- **US-02 — Başvuru.** Uygun olduğum bir programa çevrimiçi başvurmak istiyorum.
  - Başvuru yalnızca birimin başvuru takvimi açıkken yapılabilir.
  - Öğrenci belgesi ve transkript **istenmez**, veri OBİS'ten alınır ve başvuru anındaki değerleri dondurulur (anlık görüntü).
  - YKS yolu kullanılıyorsa belge numarası ve doğrulama kodu girilir.
  - Başvuru dönem kapanana kadar geri çekilebilir.
- **US-03 — Durum izleme.** Başvurumun hangi aşamada olduğunu ve sonucunu görmek istiyorum.
  - Aşamalar: Alındı → Bölüm incelemesinde → Kurul kararı bekleniyor → Kabul / Yedek / Ret.
  - Ret ve yedek durumlarında gerekçe ve sıra gösterilir.
  - Kabul edilen öğrenciye kesin kayıt için OBİS yönlendirmesi ve kayıt tarihleri gösterilir.
- **US-04 — Yan dal ders planı.** Yan dal ders havuzundan planımı oluşturup koordinatöre onaya göndermek istiyorum.
  - En az 30 AKTS ve en az 6 ders sağlanmazsa plan gönderilemez.
  - Onaylanan plan için ders kaydı OBİS'e yönlendirilir.
- **US-05 — Uyarılar.** Kaydımı riske atan durumları önceden görmek istiyorum.
  - Dönem sonunda GNO eşiğe yaklaştığında ya da altına düştüğünde, ya da bir dönem ders alınmadığında bildirim gelir.
- **US-06 — Ayrılma.** Programdan kendi isteğimle ayrılmak istiyorum.
  - ÇAP'tan ayrılırken, aldığım derslerin aynı programdaki yan dal gereklerini karşılayıp karşılamadığı ve yan dal seçenekleri gösterilir (KR-ÇAP-17).
  - Derslerin ana dala sayılması için birime yönlendirilir.

### Koordinatör ve bölüm
- **US-10 — Program ve kontenjan tanımı.** Bölüm başkanı olarak programı, kontenjanı, koordinatörü ve kabul edilen kaynak bölümleri girmek istiyorum.
  - KR-ÇAP-09'a aykırı kontenjan girilince uyarı çıkar, gerekçe istenir, kayıt engellenmez.
- **US-11 — Başvuru inceleme ve sıralama.** Koordinatör olarak başvuruları sıralanmış görmek ve bölüm önerisini hazırlamak istiyorum.
  - Sıralama ölçütü yapılandırılabilir (varsayılan: GNO azalan, eşitlikte başarı sırası). **Bkz. AS-2.**
  - Kontenjan kadar asil, ayarlanabilir sayıda yedek önerilir.
  - Koordinatör, gerekçe yazarak bir öneriyi değiştirebilir. Her değişiklik denetim kaydına yazılır.
- **US-12 — Kayıtlı öğrenci takibi.** Kendi programımdaki öğrencilerin risk durumunu görmek istiyorum.

### Birim öğrenci işleri ve ÖİDB
- **US-20 — Takvim.** Birimin başvuru, değerlendirme ve ilan tarihlerini girmek istiyorum.
- **US-21 — Kurul kararı.** Yönetim kurulu kararının tarihini, sayısını ve sonucunu girip sonuçları yayımlamak istiyorum.
  - Karar kaydedilmeden sonuç yayımlanamaz.
  - Yayımlanınca öğrencilere bildirim gider, web sitesi için yayımlanabilir liste üretilir.
- **US-22 — Kabul listesi dışa aktarma.** OBİS'te kesin kayıt için kabul listesini dışa aktarmak istiyorum (CSV/Excel).
- **US-23 — Dönem sonu taraması.** Dönem sonunda tüm kayıtlı öğrencilere kural taramasının uygulanmasını ve kayıt silme adaylarının listelenmesini istiyorum.
  - Sistem kaydı kendiliğinden silmez. Aday listesi üretir, kararı birim verir ve sisteme işler.
- **US-30 — Kural yönetimi.** ÖİDB olarak bir yönerge değişikliğinde yeni kural sürümünü, yürürlük tarihiyle tanımlamak istiyorum.
  - Her başvuru, değerlendirildiği kural sürümünü saklar.
- **US-31 — Raporlar.** Birim ve program bazında başvuru, kabul, kontenjan doluluğu ve kayıt silme sayılarını görmek istiyorum.

## 7. Gereksinimler

### 7.1 İşlevsel

| Kimlik | Gereksinim | Öncelik |
|---|---|---|
| FR-01 | Program, kontenjan, koordinatör ve kaynak bölüm kısıtı tanımları dönem bazında tutulur | Zorunlu |
| FR-02 | Birim bazında başvuru takvimi; takvim dışında başvuru kapalıdır | Zorunlu |
| FR-03 | Kural motoru: kural sürümlü ve parametreli; her sonuç kural kimliği, madde, gerçek değer ve eşikle döner | Zorunlu |
| FR-04 | Uygunluk ekranı (US-01) | Zorunlu |
| FR-05 | Çevrimiçi başvuru; başvuru anında OBİS verisinin anlık görüntüsü saklanır | Zorunlu |
| FR-06 | Başarı sıralaması (ilk %20) OBİS verisinden hesaplanır ya da okunur; öğrenciden belge istenmez | Zorunlu |
| FR-07 | Değerlendirme, sıralama, asil ve yedek önerisi, gerekçeli değiştirme | Zorunlu |
| FR-08 | Yönetim kurulu karar kaydı ve sonuç yayımlama, bildirim | Zorunlu |
| FR-09 | Kabul listesini dışa aktarma | Zorunlu |
| FR-10 | Dönem sonu kural taraması ve kayıt silme aday listesi | Zorunlu |
| FR-11 | Yan dal ders havuzu tanımı ve öğrenci planı onayı | Zorunlu |
| FR-12 | Bildirimler: sistem içi zorunlu, e-posta isteğe bağlı | Zorunlu |
| FR-13 | Ayrılma talebi ve ÇAP'tan yan dala geçiş değerlendirmesi | Önemli |
| FR-14 | Mezuniyet ve sertifika uygunluk özeti (AKTS ilerlemesi, KR-ÇAP-13, KR-YD-10) | Önemli |
| FR-15 | Raporlar (US-31) | Önemli |
| FR-16 | Yedek çağırma: asil öğrenci kayıt yaptırmazsa sıradaki yedeğe bildirim gider | Önemli |
| FR-17 | Dış sistemlere yönlendirme bağlantıları tek yerden yapılandırılır | Önemli |
| FR-18 | Kontenjan ve sonuç listesini web sitesi için yayımlanabilir PDF ya da HTML olarak üretme | İsteğe bağlı |

### 7.2 Teknik (ayrıntısı teknik dokümanda)
- **Entegrasyon katmanı:** OBİS, kimlik doğrulama, ÖSYM ve EBYS için bağdaştırıcı arayüzleri. Bu projede her birinin sahte uygulaması yazılır; gerçek uygulama sonradan takılabilir olmalı.
- **Sahte OBİS servisi:** Öğrenci, program, dönem, ders, not, GANO/YANO, sınıf sırası ve kayıt durumu verisi sunar. Tohum (seed) verisi, kural sınırlarını zorlayan senaryoları içerir (ör. GNO 2.74 / 2.75, 5. yarıyıl başı, kaynak bölüm dışı başvuru).
- **Kural motoru:** Kurallar veri olarak tanımlanır (kimlik, madde, parametre, yürürlük tarihi). Her kural için birim testi zorunludur.
- **Denetim kaydı:** Kim, ne zaman, neyi, eski değer, yeni değer ve gerekçe. Silinemez.
- **Yetkilendirme:** Rol ve birim kapsamlı. Koordinatör yalnızca kendi programını görür.
- **Dil:** Arayüz Türkçe. Tarih ve sayı biçimi tr-TR (virgüllü ondalık).

### 7.3 İşlevsel olmayan

| Konu | Gereksinim |
|---|---|
| KVKK | Yalnızca amaç için gerekli veri işlenir. Aydınlatma metni gösterilir. Kişisel veri erişimi denetim kaydına yazılır. Başvuru dönemi dışındaki veri saklama süresi tanımlanır. |
| Güvenlik | Kendi şifre deposu yok (SSO). OWASP Top 10'a karşı önlem. Rol yetkileri sunucuda denetlenir. |
| Performans | Başvuru döneminde eşzamanlı 500 kullanıcıda uygunluk ekranı 2 saniyenin altında açılır (üniversitede yaklaşık 61 bin öğrenci var; başvuru tepe yükü varsayımdır). |
| Erişilebilirlik | WCAG 2.1 AA; klavyeyle kullanılabilir. |
| Mobil | Öğrenci ekranları telefonda tam çalışır. |
| İzlenebilirlik | Her uygunluk ve karar sonucu, kullanılan kural sürümüyle yeniden üretilebilir. |

### 7.4 Tasarım
- Uygunluk ekranı "neden" sorusunu yanıtlar: her kuralın durumu, değeri ve kaynak maddesi tek bakışta görülür.
- Başvuru akışı en fazla 3 adımdır: program seçimi → bilgi onayı → gönder.
- Yönlendirme bağlantıları hangi sisteme gidildiğini açıkça söyler (ör. "Ders kaydı OBİS'te yapılır →").
- Koordinatör ekranında sıralama tablosu filtrelenebilir ve dışa aktarılabilir.

## 8. Başarı ölçütleri

Bitirme projesi gerçek kullanıma alınmayacağı için ölçütler test ve kullanıcı denemesi üzerinden tanımlanmıştır.

| Ölçüt | Hedef | Nasıl ölçülür |
|---|---|---|
| Öğrencinin elden teslim ettiği belge sayısı | 5'ten 0'a (YKS yolu kullanılıyorsa yalnızca doğrulama kodu) | Akış karşılaştırması |
| Kural doğruluğu | Bölüm 5'teki tüm kurallar için sınır değer testleri geçer | Otomatik test raporu |
| Uygunsuz başvuru | Sistem, kurallara aykırı başvuruyu kabul etmez | Test senaryoları |
| Başvuru süresi | Ortalama 5 dakikanın altında | 5–10 öğrenciyle kullanılabilirlik denemesi |
| Kullanılabilirlik | SUS puanı en az 70 | Aynı denemenin anketi |
| Koordinatör iş yükü | Sıralama tablosu hazırlama süresi elle hazırlığa göre en az %70 kısalır | Senaryolu karşılaştırma |
| Dönem sonu taraması | Tohum verisindeki tüm kayıt silme adayları bulunur, yanlış pozitif yok | Otomatik test |

## 9. Uygulama

### 9.1 Bağımlılıklar
- Yürürlükteki yönergeler (`kaynaklar/`)
- Açık soruların Öğrenci İşleri ve danışman tarafından yanıtlanması (bölüm 11)
- Sahte veri için 2026-27 kontenjan listesi (program, kontenjan, koordinatör, kaynak bölüm)

### 9.2 Takvim tahmini
Bitirme teslimi 2027 bahar dönemi sonu varsayılmıştır, danışmanla netleştirilmeli.

| Dönem | İş |
|---|---|
| Ekim 2026 | PRD, açık soruların yanıtlanması, teknik doküman (mimari, veri modeli, API) |
| Kasım 2026 | Kural motoru ve testleri, sahte OBİS ve sahte SSO |
| Aralık 2026 – Ocak 2027 | Program, kontenjan ve takvim yönetimi; uygunluk ekranı; başvuru akışı |
| Şubat – Mart 2027 | Değerlendirme, sıralama, kurul kararı, sonuç yayımlama, dışa aktarma |
| Nisan 2027 | Dönem sonu taraması, uyarılar, yan dal planı, ayrılma akışı |
| Mayıs 2027 | Kullanılabilirlik denemesi, raporlar, tez yazımı ve sunum |

### 9.3 Kaynaklar
- Geliştirici: 1 kişi (öğrenci)
- Danışman öğretim üyesi: kapsam onayı, ara değerlendirmeler
- Alan bilgisi: bir ÇAP koordinatörü ve birim öğrenci işlerinden kısa görüşme (öneri)

## 10. Riskler

| Risk | Olasılık | Etki | Önlem |
|---|---|---|---|
| OBİS'te ÇAP/yan dal modülünün zaten olması (A1) | Düşük | Yüksek | Erken doğrulama. Varsa kapsam takip ve kural motoruna daralır. |
| Yönerge maddelerinin farklı yorumlanması (ör. KR-ÇAP-11) | Orta | Orta | Kurallar parametreli. Yorum Öğrenci İşleri'nden yazılı alınır ve kural tanımına not edilir. |
| Yönergenin proje sürerken değişmesi | Orta | Düşük | Sürümlü kural seti (H5) |
| Gerçek veriye erişim olmaması | Kesin | Orta | Gerçekçi tohum verisi; kontenjan listesi gerçek, öğrenciler sahte |
| Kapsamın büyümesi | Orta | Yüksek | Bölüm 3.2 ilkesi ve öncelik sütunu; "Önemli" ve "İsteğe bağlı" maddeler zaman kalırsa yapılır |
| KVKK uyumsuzluğu | Düşük | Yüksek | Gerçek kişisel veri kullanılmaz; tasarım KVKK'ya göre belgelenir |

## 11. Açık sorular

| Kimlik | Soru | Kime |
|---|---|---|
| AS-1 | KR-ÇAP-11'deki "bir defa 2.50'nin altına düşebilir, ikinci kez 2.72'nin altına düşerse kaydı silinir" nasıl uygulanıyor? Eşik 2.50 mi, 2.72 mi? Aradaki dönemler sayılıyor mu? | ÖİDB |
| AS-2 | Kontenjandan fazla başvuruda sıralama ölçütü ne? Yönergede yazmıyor. GNO mu, başarı sırası mı, YKS puanı mı? | ÖİDB / koordinatör |
| AS-3 | Öğrenci aynı dönemde birden fazla ÇAP programına başvurabilir mi (tercih sırasıyla)? | ÖİDB |
| AS-4 | OBİS'te ÇAP veya yan dal ile ilgili bir modül var mı (A1)? Varsa ne yapıyor? | ÖİDB / Bilgi İşlem |
| AS-5 | %20 başarı sıralaması hangi veriyle ve hangi tarih itibarıyla hesaplanıyor (sınıf, kohort, GNO)? | Birim öğrenci işleri |
| AS-6 | 2026-27 yan dal kontenjan duyurusu ve başvuru formu örneği temin edilebilir mi? | Birim öğrenci işleri |
| AS-7 | Bitirme teslim tarihi, beklenen çıktı (çalışan sistem, tez, sunum) ve değerlendirme ölçütleri neler? | Danışman |

## 12. Sözlük
- **ÇAP:** Çift ana dal programı
- **GNO / GANO:** Genel (ağırlıklı) not ortalaması
- **YANO:** Yarıyıl ağırlıklı not ortalaması
- **AKTS:** Avrupa Kredi Transfer Sistemi
- **OBİS:** Selçuk Üniversitesi Öğrenci Bilgi Sistemi
- **EBYS:** Elektronik Belge Yönetim Sistemi
- **Birim:** Fakülte, yüksekokul, konservatuvar ya da meslek yüksekokulu
- **Koordinatör:** Bölüm başkanınca atanan ÇAP veya yan dal program koordinatörü

---

## Güncelleme (v0.2, 2026-10-08)

Açık soruların yanıtları ve kapsam kararı [KARARLAR.md](KARARLAR.md) dosyasındadır. Özet:

- **Kapsam (K-1):** Ürün, **rol bazlı personel paneli**dir (ÖİDB, birim öğrenci işleri, bölüm başkanı, koordinatör, danışmanlar). Başvuru kâğıtla birime gelir ve öğrenci işlerince panele girilir; öğrenci ekranları kapsam dışıdır. Bölüm 4'teki "Öğrenci" rolü ve US-01…US-06 bu nedenle "ileride" kapsamına alınmıştır.
- **AS-1 (K-2), kesin:** YÖK m.17/4. KR-ÇAP-11 güncellendi: bir defa 2,50'ye kadar düşebilir, 2,50'nin altı ya da ikinci kez 2,72'nin altı kayıt silme adayı.
- **AS-2 (K-3):** Mevzuatta ölçüt yok, yetki kurulda. Uygulamada GNO'ya göre azalan sıralama (İİBF 2023-24, 5 bölüm). Eşitlik ölçütü açık.
- **AS-3 (K-4), kesin:** Birden fazla programa başvurulabilir.
- **AS-4 (K-5), kesin:** OBİS'te başvuru modülü yok; ÇAP/yan dal ders kaydını öğrenci işleri kâğıt formdan elle girer.
- **AS-5 (K-6):** Belgeyi birim öğrenci işleri verir; hesaplama yöntemi açık.
- **Yeni gereksinimler:** başvuru girişi ve belge kontrolü (K-1), belge listeli kesin kayıt (K-8), 5 onaylı Kabul ve Ders Protokolü (K-9), dönemlik ders kayıt formu ve OBİS listesi (K-10).
- **Mevcut süreç:** [kaynaklar/mevcut-surec/MEVCUT-SUREC.md](../kaynaklar/mevcut-surec/MEVCUT-SUREC.md).

## Güncelleme (v0.3, 2026-10-08): yalnız Bilgisayar Mühendisliği, öğrenci girişi

Danışman kararıyla kapsam değişti; ayrıntı ve kaynaklar [KARARLAR.md](KARARLAR.md) K-12 – K-17 maddelerindedir. Bu bölüm, yukarıdaki metinle çeliştiği yerde geçerlidir.

- **Kapsam:** yalnız Teknoloji Fakültesi Bilgisayar Mühendisliği Bölümüne yapılan ÇAP ve yan dal. Diğer bölümler yalnızca öğrencinin ana dal bölümüdür.
- **Kullanıcılar:** öğrenci, koordinatör (ÇAP komisyonu), bölüm başkanı, ana dal imzacıları (danışman ve ana dal bölüm başkanı). Birim öğrenci işleri ve ÖİDB rolleri yoktur (bölüm 4'ün yerine).
- **Veri kaynağı:** OBİS bağlantısı yoktur. Öğrenci akademik bilgilerini kendisi girer; komisyon yüklenen belgeyle doğrular (A1 varsayımı ve FR-17 yönlendirmeleri geçersiz).
- **Yeni gereksinimler:** öğrenci bilgi ve belge girişi; çevrim içi başvuru ve dilekçe üretimi; beyan doğrulama; öğrencinin kesin kayıt onayı; bölümler arası protokol şablonu ve teknik seçmeli ders yerleri; öğrencinin hazırladığı üç imzalı ders kayıt formu; özel şartlı ders muafiyeti; komisyonun not girişi; öğrencinin dönem sonu GNO beyanı.
- **Kaldırılanlar:** birimin dilekçe girişi, belge kontrol listesiyle kesin kayıt, protokol dosyalama, ders kayıt formlarının toplu teslimi ve OBİS listesi, çok birimli ve çok programlı yapı.
- **Kurallar:** bölüm 5'teki kural kimlikleri geçerlidir; KR-ÇAP-07 (yetenek sınavı), KR-ÇAP-19 ve KR-YD-13 (ana dal dersiyle çakışma) kural setinden çıkarıldı. Sistemin kendi denetimleri taslak dosyasının 7.3 bölümündedir.
