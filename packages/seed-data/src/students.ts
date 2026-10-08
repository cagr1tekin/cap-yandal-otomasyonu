/**
 * Deneme öğrencileri. Adlar ve numaralar uydurmadır; her öğrenci bir senaryoya karşılık gelir.
 * Öğrenci numarası aynı zamanda Keycloak kullanıcı adıdır. Akademik bilgiler, öğrencinin
 * "Bilgilerim" ekranında kendi girdiği değerlerin karşılığıdır (OBİS bağlantısı yoktur, K-12).
 */

export interface SeedProfile {
  programId: string;
  entryYear: number;
  semesterNo: number;
  gano: number;
  completedAllCourses: boolean;
  classRank: number | null;
  classSize: number | null;
  entryScore: number | null;
  successRank: number | null;
  advisorUsername: string | null;
}

export interface SeedGrade {
  code: string;
  grade: string;
  termId: string;
}

export interface SeedEnrollment {
  offeringId: string;
  ganoStrikes: number;
  /** Geçilen protokol dersleri. */
  grades: SeedGrade[];
  /** Dönem → o dönem ders kayıt formuna yazılan dersler (onaylı). Boş dizi: o dönem ders alınmadı. */
  registrations: Record<string, string[]>;
  /** Dönem sonu beyanları: dönem → ana dal GNO. */
  termRecords: Record<string, number>;
}

export interface SeedStudent {
  studentNo: string;
  fullName: string;
  scenario: string;
  description: string;
  /** null: hesap var, öğrenci bilgilerini henüz girmedi. */
  profile: SeedProfile | null;
  enrollment?: SeedEnrollment;
}

const eem = (p: Partial<SeedProfile>): SeedProfile => ({
  programId: 'P-EEM',
  entryYear: 2025,
  semesterNo: 3,
  gano: 3,
  completedAllCourses: true,
  classRank: 10,
  classSize: 82,
  entryScore: 381.5,
  successRank: 120000,
  advisorUsername: 'danisman.eem',
  ...p,
});

const mak = (p: Partial<SeedProfile>): SeedProfile => ({
  ...eem({}),
  programId: 'P-MAK',
  classSize: 90,
  entryScore: 362.4,
  successRank: 165000,
  advisorUsername: 'danisman.makine',
  ...p,
});

const G = 'T-2025-GUZ';
const B = 'T-2025-BAHAR';

export const STUDENTS: SeedStudent[] = [
  {
    studentNo: '253302001',
    fullName: 'Ayşe Demirtaş',
    scenario: 'uygun-klasik',
    description: 'EEM 3. yarıyıl, GNO 3,10, sınıfında 5/82 (ilk %6,1): ÇAP için uygun',
    profile: eem({ gano: 3.1, classRank: 5 }),
  },
  {
    studentNo: '253302002',
    fullName: 'Mehmet Kaya',
    scenario: 'sinir-gno-275',
    description: 'GNO tam 2,75, sınıfında 16/82 (%19,5): sınırda uygun',
    profile: eem({ gano: 2.75, classRank: 16 }),
  },
  {
    studentNo: '253302003',
    fullName: 'Zeynep Arslan',
    scenario: 'sinir-gno-274',
    description: 'GNO 2,74: ÇAP için uygun değil, yan dal için uygun',
    profile: eem({ gano: 2.74, classRank: 15 }),
  },
  {
    studentNo: '253302004',
    fullName: 'Emre Yıldırım',
    scenario: 'yks-yolu',
    description: 'Sınıfında 30/82 (%36,6) ama YKS puanı 401,2 ≥ taban 395: taban puan yolu, belge doğrulaması gerekir',
    profile: eem({ gano: 2.95, classRank: 30, entryScore: 401.2, successRank: 61000 }),
  },
  {
    studentNo: '253302005',
    fullName: 'Elif Şahin',
    scenario: 'iki-yol-da-yok',
    description: 'Sınıfında 30/82 ve YKS puanı 380 < taban 395: uygun değil',
    profile: eem({ gano: 2.9, classRank: 30, entryScore: 380 }),
  },
  {
    studentNo: '253302006',
    fullName: 'Burak Çelik',
    scenario: 'basarisiz-ders',
    description: 'GNO 3,20 ama başarısız dersi var: uygun değil',
    profile: eem({ gano: 3.2, classRank: 6, completedAllCourses: false }),
  },
  {
    studentNo: '233302007',
    fullName: 'Selin Aydın',
    scenario: 'yariyil-disi',
    description: '7. yarıyıl: ÇAP (3–5) ve yan dal (3–6) başvuru aralığının dışında',
    profile: eem({ entryYear: 2023, semesterNo: 7, gano: 3.3, classRank: 4 }),
  },
  {
    studentNo: '253303008',
    fullName: 'Kerem Polat',
    scenario: 'kaynak-bolum-disi',
    description: 'Makine Müh.; 2026-27 güzde ÇAP yalnız EEM öğrencilerine açık: ÇAP için uygun değil, yan dal için uygun',
    profile: mak({ gano: 3.4, classRank: 4 }),
  },
  {
    studentNo: '253302009',
    fullName: 'Büşra Yalçın',
    scenario: 'siralama-1',
    description: 'GNO 3,60: sıralamada birinci',
    profile: eem({ gano: 3.6, classRank: 2 }),
  },
  {
    studentNo: '253302010',
    fullName: 'Can Öztürk',
    scenario: 'siralama-2',
    description: 'GNO 3,20: sıralamada ikinci',
    profile: eem({ gano: 3.2, classRank: 4 }),
  },
  {
    studentNo: '253302011',
    fullName: 'Deniz Acar',
    scenario: 'yedek',
    description: 'GNO 3,05: kontenjan 3 olduğu için yedek',
    profile: eem({ gano: 3.05, classRank: 8 }),
  },
  {
    studentNo: '253302012',
    fullName: 'Mert Güneş',
    scenario: 'bilgi-girmemis',
    description: 'Hesabı var, bilgilerini henüz girmedi: "Bilgilerim" ekranından başlar',
    profile: null,
  },
  {
    studentNo: '243302013',
    fullName: 'Gizem Kurt',
    scenario: 'kayitli-normal',
    description: 'Geçen yıl kabul edilen ÇAP öğrencisi; protokolü imzalı, iki dönem ders aldı. 3302458 Veri Yapıları dersini ana dalda aldı (özel şart 1)',
    profile: eem({ entryYear: 2024, semesterNo: 5, gano: 3.15, classRank: 7 }),
    enrollment: {
      offeringId: 'O-2025-GUZ-CAP',
      ganoStrikes: 0,
      grades: [
        { code: '3301156', grade: 'BA', termId: G },
        { code: '3301351', grade: 'BB', termId: G },
        { code: '3301352', grade: 'CB', termId: B },
        { code: '3301452', grade: 'BB', termId: B },
      ],
      registrations: { [G]: ['3301156', '3301351'], [B]: ['3301352', '3301452'] },
      termRecords: { [G]: 3.2, [B]: 3.15 },
    },
  },
  {
    studentNo: '243303014',
    fullName: 'Onur Tekin',
    scenario: 'gno-ilk-dusus',
    description: 'Makine Müh. ÇAP öğrencisi; ana dal GNO 2,60: ilk düşüş, uyarı (ÇAP Yön. m.9/1-e)',
    profile: mak({ entryYear: 2024, semesterNo: 5, gano: 2.6, classRank: 20 }),
    enrollment: {
      offeringId: 'O-2025-GUZ-CAP',
      ganoStrikes: 0,
      grades: [
        { code: '3301156', grade: 'CC', termId: G },
        { code: '3301256', grade: 'CC', termId: B },
      ],
      registrations: { [G]: ['3301156'], [B]: ['3301256'] },
      termRecords: { [G]: 2.8, [B]: 2.6 },
    },
  },
  {
    studentNo: '243302015',
    fullName: 'Hakan Doğan',
    scenario: 'gno-ikinci-dusus',
    description: 'Daha önce bir kez düşmüş; ana dal GNO yine 2,65 < 2,72: kayıt silme adayı',
    profile: eem({ entryYear: 2024, semesterNo: 5, gano: 2.65, classRank: 40 }),
    enrollment: {
      offeringId: 'O-2025-GUZ-CAP',
      ganoStrikes: 1,
      grades: [{ code: '3301156', grade: 'CC', termId: G }],
      registrations: { [G]: ['3301156'], [B]: ['3301351'] },
      termRecords: { [G]: 2.6, [B]: 2.65 },
    },
  },
  {
    studentNo: '243302016',
    fullName: 'İrem Koç',
    scenario: 'iki-donem-ders-yok',
    description: 'İki dönem üst üste ders almadı: kayıt silme adayı (ÇAP Yön. m.9/1-d)',
    profile: eem({ entryYear: 2024, semesterNo: 5, gano: 3.0, classRank: 12 }),
    enrollment: { offeringId: 'O-2025-GUZ-CAP', ganoStrikes: 0, grades: [], registrations: { [G]: [], [B]: [] }, termRecords: { [G]: 3.05, [B]: 3.0 } },
  },
  {
    studentNo: '243303017',
    fullName: 'Tolga Arı',
    scenario: 'yandal-kayitli',
    description: 'Makine Müh. yan dal öğrencisi; iki dönem ders aldı',
    profile: mak({ entryYear: 2024, semesterNo: 5, gano: 2.9, classRank: 25 }),
    enrollment: {
      offeringId: 'O-2025-GUZ-YANDAL',
      ganoStrikes: 0,
      grades: [
        { code: '3301156', grade: 'BB', termId: G },
        { code: '3301256', grade: 'CB', termId: B },
      ],
      registrations: { [G]: ['3301156'], [B]: ['3301256'] },
      termRecords: { [G]: 2.95, [B]: 2.9 },
    },
  },
];

export const studentEmail = (studentNo: string) => `${studentNo}@ogrenci.test`;
