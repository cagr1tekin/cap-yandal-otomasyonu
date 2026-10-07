/**
 * Birim ve programlar Selçuk Üniversitesi 2026-2027 güz çift ana dal kontenjan ilanından
 * (kaynaklar/pdf/11-...) alınmıştır. İlandaki tablo düzeni PDF'ten düz metne çevrilirken
 * bozulduğu için kontenjan sayıları, taban puanlar ve birinci sınıf mevcutları TEMSİLÎDİR.
 * Kaynak bölüm kısıtları (dipnot 1–6) ilandaki gibidir.
 */

export type Category = 'MUHENDISLIK' | 'HUKUK' | 'TIP' | 'SAGLIK' | 'DIGER';

export interface SeedUnit {
  id: string;
  code: string;
  name: string;
  kind: 'FAKULTE' | 'YUKSEKOKUL' | 'MYO' | 'KONSERVATUVAR';
}

export interface SeedProgram {
  id: string;
  unitId: string;
  name: string;
  slug: string;
  level: 'ONLISANS' | 'LISANS';
  durationYears: number;
  category: Category;
  requiresTalentExam?: boolean;
  requiresSuccessRank?: boolean;
  firstYearIntake: number;
  /** Yıl → taban puan (temsilî). */
  baseScores: Record<number, number>;
}

export const UNITS: SeedUnit[] = [
  { id: 'U-TF', code: 'TEKNOLOJI', name: 'Teknoloji Fakültesi', kind: 'FAKULTE' },
  { id: 'U-FEN', code: 'FEN', name: 'Fen Fakültesi', kind: 'FAKULTE' },
  { id: 'U-EDB', code: 'EDEBIYAT', name: 'Edebiyat Fakültesi', kind: 'FAKULTE' },
  { id: 'U-IIBF', code: 'IIBF', name: 'İktisadi ve İdari Bilimler Fakültesi', kind: 'FAKULTE' },
  { id: 'U-ILT', code: 'ILETISIM', name: 'İletişim Fakültesi', kind: 'FAKULTE' },
  { id: 'U-MTF', code: 'MIMARLIK', name: 'Mimarlık ve Tasarım Fakültesi', kind: 'FAKULTE' },
  { id: 'U-EGT', code: 'EGITIM', name: 'Eğitim Fakültesi', kind: 'FAKULTE' },
];

const p = (
  id: string,
  unitId: string,
  name: string,
  slug: string,
  category: Category,
  firstYearIntake: number,
  base: number,
  extra: Partial<SeedProgram> = {},
): SeedProgram => ({
  id,
  unitId,
  name,
  slug,
  level: 'LISANS',
  durationYears: 4,
  category,
  firstYearIntake,
  baseScores: { 2022: base - 6, 2023: base - 4, 2024: base - 2, 2025: base, 2026: base + 1 },
  ...extra,
});

export const PROGRAMS: SeedProgram[] = [
  p('P-TF-BIL', 'U-TF', 'Bilgisayar Mühendisliği', 'bilgisayar', 'MUHENDISLIK', 80, 395),
  p('P-TF-EEM', 'U-TF', 'Elektrik-Elektronik Mühendisliği', 'eem', 'MUHENDISLIK', 80, 380),
  p('P-TF-MAK', 'U-TF', 'Makine Mühendisliği', 'makine', 'MUHENDISLIK', 80, 360),
  p('P-TF-MEK', 'U-TF', 'Mekatronik Mühendisliği', 'mekatronik', 'MUHENDISLIK', 60, 365),
  p('P-TF-MET', 'U-TF', 'Metalurji ve Malzeme Mühendisliği', 'metalurji', 'MUHENDISLIK', 50, 330),
  p('P-FEN-BIY', 'U-FEN', 'Biyoloji', 'biyoloji', 'DIGER', 50, 300),
  p('P-FEN-MAT', 'U-FEN', 'Matematik', 'matematik', 'DIGER', 60, 320),
  p('P-FEN-IST', 'U-FEN', 'İstatistik', 'istatistik', 'DIGER', 40, 305),
  p('P-FEN-KIM', 'U-FEN', 'Kimya', 'kimya', 'DIGER', 50, 295),
  p('P-FEN-FIZ', 'U-FEN', 'Fizik', 'fizik', 'DIGER', 40, 290),
  p('P-FEN-AKT', 'U-FEN', 'Aktüerya Bilimleri', 'akturya', 'DIGER', 30, 340),
  p('P-EDB-TAR', 'U-EDB', 'Tarih', 'tarih', 'DIGER', 60, 330),
  p('P-EDB-FEL', 'U-EDB', 'Felsefe', 'felsefe', 'DIGER', 40, 310),
  p('P-EDB-SAN', 'U-EDB', 'Sanat Tarihi', 'sanat-tarihi', 'DIGER', 40, 300),
  p('P-IIBF-IKT', 'U-IIBF', 'İktisat', 'iktisat', 'DIGER', 100, 345),
  p('P-IIBF-ISL', 'U-IIBF', 'İşletme', 'isletme', 'DIGER', 120, 350),
  p('P-IIBF-SBKY', 'U-IIBF', 'Siyaset Bilimi ve Kamu Yönetimi', 'sbky', 'DIGER', 100, 335),
  p('P-IIBF-UI', 'U-IIBF', 'Uluslararası İlişkiler', 'uluslararasi-iliskiler', 'DIGER', 80, 360),
  p('P-ILT-GAZ', 'U-ILT', 'Gazetecilik', 'gazetecilik', 'DIGER', 60, 325),
  p('P-ILT-HIT', 'U-ILT', 'Halkla İlişkiler ve Tanıtım', 'halkla-iliskiler', 'DIGER', 60, 335),
  p('P-ILT-REK', 'U-ILT', 'Reklamcılık', 'reklamcilik', 'DIGER', 50, 330),
  p('P-MTF-MODA', 'U-MTF', 'Moda Tasarımı', 'moda', 'DIGER', 40, 280, { requiresTalentExam: true }),
  p('P-EGT-SINIF', 'U-EGT', 'Sınıf Öğretmenliği', 'sinif-ogretmenligi', 'DIGER', 60, 390, { requiresSuccessRank: true }),
  p('P-EGT-TURK', 'U-EGT', 'Türkçe Öğretmenliği', 'turkce-ogretmenligi', 'DIGER', 60, 385, { requiresSuccessRank: true }),
  p('P-EGT-MATO', 'U-EGT', 'Matematik Öğretmenliği', 'matematik-ogretmenligi', 'DIGER', 50, 395, { requiresSuccessRank: true }),
];

export const programById = (id: string): SeedProgram => {
  const found = PROGRAMS.find((x) => x.id === id);
  if (!found) throw new Error(`Program yok: ${id}`);
  return found;
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
  programId: string;
  termId: string;
  type: 'CAP' | 'YANDAL';
  quota: number;
  sourceProgramIds: string[];
  /** Ders havuzu kodları (yalnızca yan dal). */
  pool?: string[];
}

const ALL_EGT = ['P-EGT-SINIF', 'P-EGT-TURK', 'P-EGT-MATO'];

const cap = (programId: string, quota: number, sourceProgramIds: string[] = [], termId = CURRENT_TERM_ID): SeedOffering => ({
  id: `O-${termId.slice(2)}-CAP-${programId.slice(2)}`,
  programId,
  termId,
  type: 'CAP',
  quota,
  sourceProgramIds,
});

const yandal = (programId: string, quota: number, pool: string[], termId = CURRENT_TERM_ID): SeedOffering => ({
  id: `O-${termId.slice(2)}-YD-${programId.slice(2)}`,
  programId,
  termId,
  type: 'YANDAL',
  quota,
  sourceProgramIds: [],
  pool,
});

export const OFFERINGS: SeedOffering[] = [
  // 2026-2027 güz — ilandaki dipnotlu Teknoloji Fakültesi kısıtları
  cap('P-TF-BIL', 3, ['P-TF-EEM']),
  cap('P-TF-EEM', 2, ['P-TF-BIL', 'P-TF-MAK', 'P-TF-MEK']),
  cap('P-TF-MAK', 3, ['P-TF-BIL', 'P-TF-EEM', 'P-TF-MET']),
  cap('P-TF-MEK', 3, ['P-TF-BIL', 'P-TF-EEM', 'P-TF-MAK']),
  cap('P-TF-MET', 2, ['P-TF-MAK', 'P-TF-MEK', 'P-TF-BIL', 'P-TF-EEM']),
  cap('P-FEN-BIY', 10),
  cap('P-FEN-MAT', 5),
  cap('P-FEN-IST', 3),
  cap('P-FEN-KIM', 5),
  cap('P-FEN-FIZ', 5),
  cap('P-FEN-AKT', 4),
  cap('P-EDB-TAR', 6),
  cap('P-EDB-FEL', 3),
  cap('P-EDB-SAN', 2),
  cap('P-IIBF-IKT', 4),
  cap('P-IIBF-ISL', 10),
  cap('P-IIBF-UI', 10),
  cap('P-ILT-GAZ', 10),
  cap('P-ILT-HIT', 5),
  cap('P-ILT-REK', 5),
  cap('P-MTF-MODA', 9),
  cap('P-EGT-SINIF', 2, ALL_EGT),
  yandal('P-IIBF-ISL', 10, ['ISL101', 'ISL105', 'ISL201', 'ISL203', 'ISL205', 'ISL301', 'ISL303', 'ISL305', 'ISL401', 'ISL403']),
  yandal('P-FEN-IST', 5, ['IST101', 'IST103', 'IST201', 'IST203', 'IST205', 'IST301', 'IST303', 'IST305', 'IST401', 'IST403']),
  yandal('P-ILT-HIT', 5, ['HIT101', 'HIT103', 'HIT201', 'HIT203', 'HIT205', 'HIT301', 'HIT303', 'HIT305', 'HIT401', 'HIT403']),
  // 2025-2026 güz — mevcut kayıtlar için geçmiş dönem teklifleri
  cap('P-IIBF-IKT', 4, [], 'T-2025-GUZ'),
  cap('P-ILT-HIT', 5, [], 'T-2025-GUZ'),
  cap('P-FEN-IST', 3, [], 'T-2025-GUZ'),
  yandal('P-IIBF-ISL', 10, ['ISL101', 'ISL105', 'ISL201', 'ISL203', 'ISL205', 'ISL301', 'ISL303', 'ISL305', 'ISL401', 'ISL403'], 'T-2025-GUZ'),
];

export interface SeedCourse {
  code: string;
  name: string;
  ects: number;
}

export const COURSES: SeedCourse[] = [
  ['ISL101', 'İşletmeye Giriş'],
  ['ISL105', 'Genel Muhasebe'],
  ['ISL201', 'Pazarlama İlkeleri'],
  ['ISL203', 'Örgütsel Davranış'],
  ['ISL205', 'Finansal Yönetim'],
  ['ISL301', 'Üretim Yönetimi'],
  ['ISL303', 'İnsan Kaynakları Yönetimi'],
  ['ISL305', 'Maliyet Muhasebesi'],
  ['ISL401', 'Stratejik Yönetim'],
  ['ISL403', 'Girişimcilik'],
  ['IST101', 'İstatistiğe Giriş'],
  ['IST103', 'Olasılık'],
  ['IST201', 'İstatistiksel Çıkarım'],
  ['IST203', 'Regresyon Analizi'],
  ['IST205', 'Örnekleme'],
  ['IST301', 'Deney Tasarımı'],
  ['IST303', 'Zaman Serileri'],
  ['IST305', 'Çok Değişkenli İstatistik'],
  ['IST401', 'Parametrik Olmayan Yöntemler'],
  ['IST403', 'Veri Madenciliği'],
  ['HIT101', 'Halkla İlişkilere Giriş'],
  ['HIT103', 'İletişim Kuramları'],
  ['HIT201', 'Kurumsal İletişim'],
  ['HIT203', 'Tanıtım ve Reklam'],
  ['HIT205', 'Kriz İletişimi'],
  ['HIT301', 'Kampanya Yönetimi'],
  ['HIT303', 'Dijital Halkla İlişkiler'],
  ['HIT305', 'Medya İlişkileri'],
  ['HIT401', 'Kurumsal Sosyal Sorumluluk'],
  ['HIT403', 'İtibar Yönetimi'],
  ['IKT101', 'İktisada Giriş'],
  ['IKT103', 'Matematiksel İktisat'],
].map(([code, name]) => ({ code, name, ects: 6 }));

export const courseByCode = (code: string): SeedCourse => {
  const c = COURSES.find((x) => x.code === code);
  if (!c) throw new Error(`Ders yok: ${code}`);
  return c;
};
