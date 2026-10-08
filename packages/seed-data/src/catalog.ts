/**
 * Kapsam: Selçuk Üniversitesi Teknoloji Fakültesi Bilgisayar Mühendisliği Bölümü (docs/KARARLAR.md K-12).
 *
 * GERÇEK veriler ve kaynakları:
 *  - Müfredat (ders kodu, ad, AKTS, yarıyıl): Bologna ders paketi,
 *    https://bologna.selcuk.edu.tr/tr/dersler/teknoloji-bilgisayar_muhendisligi-bilgisayar_muhendisligi-lisans (8/10/2026)
 *  - Kaynak bölümler: 2026-27 güz ÇAP kontenjan ilanı dipnot 1 (yalnız Elektrik-Elektronik Müh.).
 *
 * TEMSİLÎ veriler: kontenjan sayıları (ilan tablosu metne bozuk aktarıldı), taban puanlar (YÖK Atlas'tan
 * doğrulanmadı; koordinatör panelden girer), yan dal teklifi.
 */

export interface SeedProgram {
  id: string;
  name: string;
  faculty: string;
  slug: string;
  /** Ders kodlarının ilk dört hanesi (biliniyorsa). */
  codePrefix: string | null;
  isHome: boolean;
}

export const HOME_PROGRAM_ID = 'P-BIL';
const TF = 'Teknoloji Fakültesi';

export const PROGRAMS: SeedProgram[] = [
  { id: 'P-BIL', name: 'Bilgisayar Mühendisliği', faculty: TF, slug: 'bilgisayar', codePrefix: '3301', isHome: true },
  { id: 'P-EEM', name: 'Elektrik-Elektronik Mühendisliği', faculty: TF, slug: 'eem', codePrefix: '3302', isHome: false },
  { id: 'P-MAK', name: 'Makine Mühendisliği', faculty: TF, slug: 'makine', codePrefix: '3303', isHome: false },
  { id: 'P-MEK', name: 'Mekatronik Mühendisliği', faculty: TF, slug: 'mekatronik', codePrefix: null, isHome: false },
  { id: 'P-MET', name: 'Metalurji ve Malzeme Mühendisliği', faculty: TF, slug: 'metalurji', codePrefix: null, isHome: false },
];

export type CourseKind = 'ZORUNLU' | 'TEKNIK_SECMELI' | 'SOSYAL_SECMELI';

export interface SeedCourse {
  code: string;
  name: string;
  ects: number;
  semester: number;
  kind: CourseKind;
}

const Z = 'ZORUNLU';
const T = 'TEKNIK_SECMELI';
const S = 'SOSYAL_SECMELI';
type Row = [code: string, name: string, ects: number, kind: CourseKind];

const BY_SEMESTER: Record<number, Row[]> = {
  1: [
    ['3301151', 'Matematik-1', 6, Z],
    ['3301152', 'Fizik-1', 6, Z],
    ['3301153', 'Türk Dili I', 2, Z],
    ['3301154', 'Atatürk İlkeleri ve İnkılap Tarihi-1', 2, Z],
    ['3301155', 'Yabancı Dil-1', 2, Z],
    ['3301156', 'Bilgisayar Mühendisliğine Giriş', 4, Z],
    ['3301157', 'İş Sağlığı ve Güvenliği-1', 2, Z],
    ['3301158', 'Lineer Cebir', 6, Z],
  ],
  2: [
    ['3301251', 'Matematik-2', 6, Z],
    ['3301252', 'Fizik-2', 6, Z],
    ['3301253', 'Türk Dili II', 2, Z],
    ['3301254', 'Atatürk İlkeleri ve İnkılap Tarihi-2', 2, Z],
    ['3301255', 'Yabancı Dil-2', 2, Z],
    ['3301256', 'Programlama Dili-1', 4, Z],
    ['3301257', 'İş Sağlığı ve Güvenliği-2', 2, Z],
    ['3301258', 'Ayrık Matematik', 6, Z],
  ],
  3: [
    ['3301351', 'Nesneye Yönelik Programlama Dili', 4, Z],
    ['3301352', 'İşletim Sistemleri', 4, Z],
    ['3301353', 'Mantık Devreleri-1', 4, Z],
    ['3301354', 'Veri Yapıları ve Uygulamaları', 4, Z],
    ['3301355', 'Elektronik Devre Elemanları ve Ölçme', 4, Z],
    ['3301356', 'Sayısal Yöntemler', 5, Z],
    ['3301357', 'İstatistik ve Olasılık', 5, Z],
  ],
  4: [
    ['3301451', 'Mühendislik Matematiği', 7, Z],
    ['3301452', 'Programlama Dili-2', 4, Z],
    ['3301453', 'Mantık Devreleri-2', 4, Z],
    ['3301454', 'Veritabanı Yönetim Sistemleri', 5, Z],
    ['3301455', 'Yazılım Mühendisliği', 4, Z],
    ['3301456', 'Mobil Programlama', 4, Z],
    ['3301461', 'Teknoloji Tarihi', 2, S],
    ['3301462', 'İş Hukuku ve Etik', 2, S],
    ['3301463', 'İletişim Becerileri ve Akademik Raporlama', 2, S],
    ['3301464', 'Sosyal Sorumluluk ve Değerler Eğitimi', 2, S],
    ['3301465', 'Etkili İletişim ve Beden Dili', 2, S],
    ['3301466', 'Medya Okur Yazarlığı', 2, S],
    ['3301467', 'Yönetim ve Organizasyon', 2, S],
    ['3301468', 'Çevre ve Ekoloji', 2, S],
    ['3301469', 'Yaşam Boyu Öğrenme', 2, S],
    ['3301470', 'İletişim ve Stres Yönetimi', 2, S],
    ['3301471', 'Gönüllülük Çalışmaları', 2, S],
    ['3301472', 'Dijital Dönüşüm', 2, S],
    ['3301473', 'Sosyal İngilizce', 2, S],
  ],
  5: [
    ['3301551', 'Mikroişlemciler ve Mikrodenetleyiciler', 5, Z],
    ['3301552', 'Programlama Dili-3', 5, Z],
    ['3301553', 'Veri Haberleşmesi ve Ağlar', 5, Z],
    ['3301554', 'Teknik İngilizce', 3, Z],
    ['3301561', 'Sinyal İşleme', 4, T],
    ['3301562', 'Tasarım Desenleri', 4, T],
    ['3301563', 'İnsan Bilgisayar Etkileşimi', 4, T],
    ['3301564', 'Biyomedikal Sistemler', 4, T],
    ['3301565', 'Simülasyon ve Modelleme', 4, T],
    ['3301566', 'Bilgisayar Donanımı', 4, T],
    ['3301567', 'Web Tasarımı', 4, T],
    ['3301568', 'Veri Madenciliği', 4, T],
    ['3301569', 'Adli Bilişim', 4, T],
    ['3301570', 'Veri Tabanı Programlama', 4, T],
    ['3301571', 'Makine Öğrenmesi', 4, T],
    ['3301572', 'Algoritma Analizi', 4, T],
    ['3301573', 'Doğal Dil İşleme Temelleri', 4, T],
    ['3301574', 'Nesnelerin İnterneti', 4, T],
    ['3301575', 'İleri Dijital Sistemler', 4, T],
    ['3301576', 'Bilgisayar Mühendisliğinde Özel Konular', 4, T],
    ['3301577', 'Siber Sistemler ve Bilgi Güvenliği', 4, T],
    ['3301578', 'Sürdürülebilir Yazılım Mühendisliği', 4, T],
  ],
  6: [
    ['3301651', 'Yapay Zeka', 4, Z],
    ['3301652', 'Otomata Teorisi ve Biçimsel Diller', 4, Z],
    ['3301653', 'Görüntü İşleme', 4, Z],
    ['3301654', 'Mühendislik Tasarımı', 6, Z],
    ['3301661', 'Sistem Programlama', 4, T],
    ['3301662', 'Bilgisayar ve Ağ Güvenliği', 4, T],
    ['3301663', 'Gömülü Sistemler', 4, T],
    ['3301664', 'İş Zekası', 4, T],
    ['3301665', 'Robotik', 4, T],
    ['3301666', 'İşletim Sistemleri Yönetimi', 4, T],
    ['3301667', 'Web Servisleri', 4, T],
    ['3301668', 'Mikrobilgisayarlı Sistem Tasarımı', 4, T],
    ['3301669', 'Mesleki İngilizce', 4, T],
    ['3301670', 'Kriptoloji', 4, T],
    ['3301671', 'Bilgisayar Bilimlerinde İnovasyon ve Araştırma Teknikleri', 4, T],
    ['3301672', 'Disiplinlerarası Çalışma', 4, T],
    ['3301673', 'Gerçekçi Modelleme ve Simülasyon Tasarımı', 4, T],
    ['3301674', 'Web Programlama', 4, T],
    ['3301675', 'Sürdürülebilir Bilişim Teknolojileri', 4, T],
    ['3301676', 'Steganografi', 4, T],
  ],
  7: [
    ['3301751', 'Bilgisayar Mühendisliği Uygulamaları', 4, Z],
    ['3301752', 'Bilgisayar Mimarisi ve Organizasyonu', 4, Z],
    ['3301753', 'Veri Bilimi', 4, Z],
    ['3301754', 'Girişimcilik ve Proje Yönetimi', 3, Z],
    ['3301761', 'Programlanabilir Mantık Kontrolör', 4, T],
    ['3301762', 'Paralel İşlemcili Sistemler', 4, T],
    ['3301763', 'Kontrol Sistemleri', 4, T],
    ['3301764', 'Bilgisayar Destekli Tasarım', 4, T],
    ['3301765', 'Yöneylem Araştırması', 4, T],
    ['3301766', 'Kablosuz Ağlar', 4, T],
    ['3301767', 'Bulut Bilişim', 4, T],
    ['3301768', 'Paket Programlar', 4, T],
    ['3301769', 'Bilgisayar Grafikleri', 4, T],
    ['3301770', 'Veri İletişim Teknikleri', 4, T],
    ['3301771', 'Oyun Programlama', 4, T],
    ['3301772', 'E-Ticaret ve Uygulamaları', 4, T],
    ['3301773', 'Paralel Programlama', 4, T],
    ['3301774', 'MVC Tabanlı Web Mimarisi', 4, T],
    ['3301775', 'Yeşil Bilişim', 4, T],
    ['3301776', 'Çevre ve Enerji', 6, T],
    ['3301777', 'Blokzincir Temelleri', 4, T],
    ['3301778', 'Büyük Veri Analitiği', 4, T],
    ['3301779', 'Bilgisayarla Görme', 4, T],
    ['3301782', 'Kalite ve Güvence Sistemleri', 2, S],
    ['3301783', 'Mühendislik Ekonomisi', 2, S],
    ['3301784', 'İşaret Dili', 2, S],
    ['3301785', 'Dış Ticaret', 2, S],
    ['3301786', 'Topluma Hizmet Uygulamaları', 2, S],
    ['3301787', 'Reklamcılık ve Stratejileri', 2, S],
    ['3301788', 'Araştırma ve Rapor Yazma Teknikleri', 2, S],
    ['3301789', 'Mühendislik Etiği', 2, S],
  ],
  8: [
    ['3301851', 'İşletmede Mesleki Eğitim', 20, Z],
    ['3301852', 'Staj-1', 5, Z],
    ['3301853', 'Staj-2', 5, Z],
  ],
};

/** Bilgisayar Mühendisliği lisans müfredatı (Bologna ders paketi). */
export const COURSES: SeedCourse[] = Object.entries(BY_SEMESTER).flatMap(([semester, rows]) =>
  rows.map(([code, name, ects, kind]) => ({ code, name, ects, semester: Number(semester), kind })),
);

export const course = (code: string): SeedCourse => {
  const c = COURSES.find((x) => x.code === code);
  if (!c) throw new Error(`Müfredatta olmayan ders: ${code}`);
  return c;
};

export interface SeedTerm {
  id: string;
  year: string;
  season: 'GUZ' | 'BAHAR';
  startsAt: string;
  endsAt: string;
  current?: boolean;
}

export const TERMS: SeedTerm[] = [
  { id: 'T-2025-GUZ', year: '2025-2026', season: 'GUZ', startsAt: '2025-09-15', endsAt: '2026-01-25' },
  { id: 'T-2025-BAHAR', year: '2025-2026', season: 'BAHAR', startsAt: '2026-02-09', endsAt: '2026-06-28' },
  { id: 'T-2026-GUZ', year: '2026-2027', season: 'GUZ', startsAt: '2026-09-14', endsAt: '2027-01-24', current: true },
  { id: 'T-2026-BAHAR', year: '2026-2027', season: 'BAHAR', startsAt: '2027-02-08', endsAt: '2027-06-27' },
];

export const CURRENT_TERM_ID = 'T-2026-GUZ';

export interface SeedOffering {
  id: string;
  termId: string;
  type: 'CAP' | 'YANDAL';
  quota: number;
  /** Boşsa her bölümden başvuru alınır. */
  sourceProgramIds: string[];
  firstYearIntake: number;
}

export const OFFERINGS: SeedOffering[] = [
  // 2026-27 güz ilanı, dipnot 1: "Elektrik-Elektronik Mühendisliği Bölümünden öğrenci kabul edilecektir."
  { id: 'O-2026-GUZ-CAP', termId: 'T-2026-GUZ', type: 'CAP', quota: 3, sourceProgramIds: ['P-EEM'], firstYearIntake: 80 },
  { id: 'O-2026-GUZ-YANDAL', termId: 'T-2026-GUZ', type: 'YANDAL', quota: 5, sourceProgramIds: [], firstYearIntake: 80 },
  // Önceki yıl: bölüm sitesinde protokolü bulunan iki bölüm (EEM, Makine).
  { id: 'O-2025-GUZ-CAP', termId: 'T-2025-GUZ', type: 'CAP', quota: 6, sourceProgramIds: ['P-EEM', 'P-MAK'], firstYearIntake: 80 },
  { id: 'O-2025-GUZ-YANDAL', termId: 'T-2025-GUZ', type: 'YANDAL', quota: 5, sourceProgramIds: [], firstYearIntake: 80 },
];

/**
 * Bilgisayar Mühendisliğinin yıllara göre taban puanı (TEMSİLÎ) ve başarı sırası şartı.
 * Mühendislik programlarında başarı sırası şartı 300.000'dir; koordinatör panelden günceller.
 */
export const YEAR_STATS: { year: number; baseScore: number; successRankLimit: number }[] = [
  { year: 2022, baseScore: 389, successRankLimit: 300000 },
  { year: 2023, baseScore: 391, successRankLimit: 300000 },
  { year: 2024, baseScore: 393, successRankLimit: 300000 },
  { year: 2025, baseScore: 395, successRankLimit: 300000 },
  { year: 2026, baseScore: 396, successRankLimit: 300000 },
];
