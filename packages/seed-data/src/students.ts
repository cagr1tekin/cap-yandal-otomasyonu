/**
 * Sahte öğrenciler. Adlar uydurmadır; her öğrenci bir test senaryosuna karşılık gelir
 * (teknik doküman bölüm 12). Öğrenci numarası aynı zamanda Keycloak kullanıcı adıdır.
 */

export interface SeedCourseResult {
  code: string;
  grade: string;
  passed: boolean;
}

export interface SeedTrack {
  programId: string;
  gpaByTerm: number[];
  consecutiveTermsWithoutCourse: number;
  results: SeedCourseResult[];
}

export interface SeedStudent {
  studentNo: string;
  fullName: string;
  scenario: string;
  description: string;
  programId: string;
  semesterNo: number;
  gano: number;
  completedAllCoursesToDate: boolean;
  classRankPercentile: number | null;
  entryScore: { year: number; score: number } | null;
  yokRankRequirementMet: boolean | null;
  talentExamPassedProgramIds: string[];
  frozen: boolean;
  advisorUsername: string;
  tracks: SeedTrack[];
  osymDocument?: { docNo: string; verificationCode: string };
}

const base = {
  semesterNo: 3,
  completedAllCoursesToDate: true,
  yokRankRequirementMet: null,
  talentExamPassedProgramIds: [] as string[],
  frozen: false,
  tracks: [] as SeedTrack[],
};

const passed = (codes: string[], grade = 'BB'): SeedCourseResult[] => codes.map((code) => ({ code, grade, passed: true }));

export const STUDENTS: SeedStudent[] = [
  {
    ...base,
    studentNo: '230201001',
    fullName: 'Ayşe Demirtaş',
    scenario: 'uygun-klasik',
    description: 'İşletme 3. yarıyıl, GNO 3,10, sınıfında ilk %8 — İktisat ÇAP için uygun',
    programId: 'P-IIBF-ISL',
    gano: 3.1,
    classRankPercentile: 8,
    entryScore: { year: 2025, score: 362 },
    advisorUsername: 'danisman.isletme',
  },
  {
    ...base,
    studentNo: '230201002',
    fullName: 'Mehmet Kaya',
    scenario: 'sinir-gno-275',
    description: 'GNO tam 2,75 — sınırda uygun',
    programId: 'P-IIBF-ISL',
    gano: 2.75,
    classRankPercentile: 18,
    entryScore: { year: 2025, score: 355 },
    advisorUsername: 'danisman.isletme',
  },
  {
    ...base,
    studentNo: '230201003',
    fullName: 'Zeynep Arslan',
    scenario: 'sinir-gno-274',
    description: 'GNO 2,74 — ÇAP için uygun değil, yan dal için uygun',
    programId: 'P-IIBF-ISL',
    gano: 2.74,
    classRankPercentile: 19,
    entryScore: { year: 2025, score: 352 },
    advisorUsername: 'danisman.isletme',
  },
  {
    ...base,
    studentNo: '230301004',
    fullName: 'Emre Yıldırım',
    scenario: 'yks-yolu',
    description: 'Tarih, GNO 2,90, sınıfında %35 — YKS puanı İktisat tabanının üstünde (koşullu)',
    programId: 'P-EDB-TAR',
    gano: 2.9,
    classRankPercentile: 35,
    entryScore: { year: 2025, score: 371.5 },
    advisorUsername: 'danisman.tarih',
    osymDocument: { docNo: 'YKS2025-0001234', verificationCode: 'AB12CD' },
  },
  {
    ...base,
    studentNo: '220201005',
    fullName: 'Elif Şahin',
    scenario: 'pencere-disi',
    description: 'İşletme 6. yarıyıl — ÇAP penceresi dışında, yan dal penceresinde',
    programId: 'P-IIBF-ISL',
    semesterNo: 6,
    gano: 3.3,
    classRankPercentile: 6,
    entryScore: { year: 2024, score: 360 },
    advisorUsername: 'danisman.isletme',
  },
  {
    ...base,
    studentNo: '230501006',
    fullName: 'Burak Özdemir',
    scenario: 'kaynak-bolum-disi',
    description: 'Makine Müh. — Bilgisayar Müh. ÇAP yalnızca EEM öğrencisi alıyor',
    programId: 'P-TF-MAK',
    gano: 3.4,
    classRankPercentile: 5,
    entryScore: { year: 2025, score: 372 },
    advisorUsername: 'danisman.makine',
  },
  {
    ...base,
    studentNo: '220201007',
    fullName: 'Selin Aydın',
    scenario: 'ikinci-cap',
    description: 'Zaten etkin İktisat ÇAP kaydı var — ikinci ÇAP\'a başvuramaz',
    programId: 'P-IIBF-ISL',
    semesterNo: 5,
    gano: 3.2,
    classRankPercentile: 9,
    entryScore: { year: 2024, score: 358 },
    advisorUsername: 'danisman.isletme',
    tracks: [{ programId: 'P-IIBF-IKT', gpaByTerm: [3.0, 3.1], consecutiveTermsWithoutCourse: 0, results: passed(['IKT101', 'IKT103']) }],
  },
  {
    ...base,
    studentNo: '220301008',
    fullName: 'Can Polat',
    scenario: 'yandal-gno-dususu',
    description: 'İşletme yan dalında; ana dal GNO 2,29\'a düştü — dönem sonu taramasında kayıt silme adayı',
    programId: 'P-EDB-TAR',
    semesterNo: 5,
    gano: 2.29,
    classRankPercentile: 60,
    entryScore: { year: 2024, score: 330 },
    advisorUsername: 'danisman.tarih',
    tracks: [{ programId: 'P-IIBF-ISL', gpaByTerm: [2.6, 2.4], consecutiveTermsWithoutCourse: 0, results: passed(['ISL101', 'ISL105'], 'CB') }],
  },
  {
    ...base,
    studentNo: '220201009',
    fullName: 'Deniz Koç',
    scenario: 'cap-iki-darbe',
    description: 'İktisat ÇAP; GNO daha önce bir kez 2,72 altına düşmüş, şimdi 2,60 — kayıt silme adayı',
    programId: 'P-IIBF-ISL',
    semesterNo: 5,
    gano: 2.6,
    classRankPercentile: 40,
    entryScore: { year: 2024, score: 357 },
    advisorUsername: 'danisman.isletme',
    tracks: [{ programId: 'P-IIBF-IKT', gpaByTerm: [2.8, 2.5], consecutiveTermsWithoutCourse: 0, results: passed(['IKT101'], 'CC') }],
  },
  {
    ...base,
    studentNo: '220601010',
    fullName: 'Gizem Çelik',
    scenario: 'iki-donem-ders-yok',
    description: 'Gazetecilik; Halkla İlişkiler ÇAP\'ından üst üste iki dönem ders almamış',
    programId: 'P-ILT-GAZ',
    semesterNo: 5,
    gano: 3.05,
    classRankPercentile: 15,
    entryScore: { year: 2024, score: 330 },
    advisorUsername: 'danisman.gazetecilik',
    tracks: [{ programId: 'P-ILT-HIT', gpaByTerm: [3.2], consecutiveTermsWithoutCourse: 2, results: passed(['HIT101']) }],
  },
  {
    ...base,
    studentNo: '220401011',
    fullName: 'Oğuz Kılıç',
    scenario: 'cap-to-yandal',
    description: 'Matematik; İstatistik ÇAP\'ından ayrılırsa aldığı 7 ders (42 AKTS) yan dal sertifikasına yeter',
    programId: 'P-FEN-MAT',
    semesterNo: 5,
    gano: 3.15,
    classRankPercentile: 12,
    entryScore: { year: 2024, score: 325 },
    advisorUsername: 'danisman.matematik',
    tracks: [
      {
        programId: 'P-FEN-IST',
        gpaByTerm: [3.0, 2.9],
        consecutiveTermsWithoutCourse: 0,
        results: passed(['IST101', 'IST103', 'IST201', 'IST203', 'IST205', 'IST301', 'IST303']),
      },
    ],
  },
  {
    ...base,
    studentNo: '230201012',
    fullName: 'Hakan Toprak',
    scenario: 'ders-eksik',
    description: 'GNO 3,00 ama başarısız dersi var — tüm derslerin geçilmesi şartı sağlanmıyor',
    programId: 'P-IIBF-ISL',
    gano: 3.0,
    completedAllCoursesToDate: false,
    classRankPercentile: 14,
    entryScore: { year: 2025, score: 356 },
    advisorUsername: 'danisman.isletme',
  },
  {
    ...base,
    studentNo: '230501020',
    fullName: 'Merve Aktaş',
    scenario: 'eem-bilgisayar',
    description: 'EEM öğrencisi — Bilgisayar Müh. ÇAP için uygun',
    programId: 'P-TF-EEM',
    gano: 3.3,
    classRankPercentile: 5,
    entryScore: { year: 2025, score: 384 },
    advisorUsername: 'danisman.eem',
  },
  {
    ...base,
    studentNo: '230701022',
    fullName: 'Sena Uçar',
    scenario: 'basari-siralamasi',
    description: 'Türkçe Öğretmenliği — Sınıf Öğretmenliği ÇAP, YÖK başarı sıralaması şartı sağlanıyor',
    programId: 'P-EGT-TURK',
    gano: 3.25,
    classRankPercentile: 10,
    entryScore: { year: 2025, score: 392 },
    yokRankRequirementMet: true,
    advisorUsername: 'danisman.turkce',
  },
  {
    ...base,
    studentNo: '220201023',
    fullName: 'Ali Erdem',
    scenario: 'dondurulmus',
    description: 'İktisat ÇAP\'ı var; ana dalda kaydını dondurdu — ÇAP kaydı da dondurulmuş sayılır',
    programId: 'P-IIBF-ISL',
    semesterNo: 5,
    gano: 3.0,
    classRankPercentile: 20,
    entryScore: { year: 2024, score: 356 },
    frozen: true,
    advisorUsername: 'danisman.isletme',
    tracks: [{ programId: 'P-IIBF-IKT', gpaByTerm: [3.1], consecutiveTermsWithoutCourse: 1, results: passed(['IKT101']) }],
  },
  // İktisat ÇAP sıralama kalabalığı (kontenjan 4)
  ...([
    ['230201030', 'Büşra Yalçın', 3.62, 2],
    ['230201031', 'Furkan Güneş', 3.45, 4],
    ['230201032', 'İrem Bozkurt', 3.33, 6],
    ['230201033', 'Kerem Aksoy', 3.05, 11],
    ['230201034', 'Melis Karaca', 2.95, 13],
    ['230201035', 'Tolga Er', 2.81, 17],
  ] as const).map(([studentNo, fullName, gano, rank]) => ({
    ...base,
    studentNo,
    fullName,
    scenario: 'siralama-kalabaligi',
    description: `İktisat ÇAP sıralama kalabalığı — GNO ${String(gano).replace('.', ',')}`,
    programId: 'P-IIBF-ISL',
    gano,
    classRankPercentile: rank,
    entryScore: { year: 2025, score: 358 },
    advisorUsername: 'danisman.isletme',
  })),
];

/** Önceki dönemden gelen etkin kayıtlar (veritabanı seed'i oluşturur). */
export interface SeedEnrollment {
  studentNo: string;
  offeringId: string;
  ganoStrikes: number;
}

export const EXISTING_ENROLLMENTS: SeedEnrollment[] = [
  { studentNo: '220201007', offeringId: 'O-2025-GUZ-CAP-IIBF-IKT', ganoStrikes: 0 },
  { studentNo: '220301008', offeringId: 'O-2025-GUZ-YD-IIBF-ISL', ganoStrikes: 0 },
  { studentNo: '220201009', offeringId: 'O-2025-GUZ-CAP-IIBF-IKT', ganoStrikes: 1 },
  { studentNo: '220601010', offeringId: 'O-2025-GUZ-CAP-ILT-HIT', ganoStrikes: 0 },
  { studentNo: '220401011', offeringId: 'O-2025-GUZ-CAP-FEN-IST', ganoStrikes: 0 },
  { studentNo: '220201023', offeringId: 'O-2025-GUZ-CAP-IIBF-IKT', ganoStrikes: 0 },
];

export const studentEmail = (studentNo: string) => `${studentNo}@ogrenci.test`;
