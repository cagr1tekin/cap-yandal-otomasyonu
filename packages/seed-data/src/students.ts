/**
 * Sentetik öğrenciler (e-postadaki "yalnızca sentetik veri" şartı). Adlar ve numaralar uydurmadır;
 * her öğrenci bir senaryoya karşılık gelir. Öğrenci numarası Keycloak kullanıcı adıdır.
 *
 * Geçmiş dönem kayıtları, koordinatörün sistem açılışındaki geriye dönük girişinin karşılığıdır
 * (kaynak BACKFILL, onay kilidine takılmaz).
 */

export type SeedReview = 'APPROVED' | 'PENDING';

export interface SeedAttempt {
  code: string;
  termId: string;
  grade?: string;
  status?: SeedReview;
}

export interface SeedStudent {
  studentNo: string;
  fullName: string;
  track: 'CAP' | 'YANDAL';
  admissionTermId: string;
  mainProgramId: string;
  scenario: string;
  description: string;
  /** Ders listesi: şablondan (onaylı) ya da öğrencinin girdiği ders kodları (onay bekliyor). */
  templateId?: string;
  pendingPlan?: string[];
  attempts: SeedAttempt[];
  gano: { termId: string; gano: number; mainGraduated?: boolean; mainFrozen?: boolean }[];
  documents: { kind: string; termId?: string; status: SeedReview }[];
  /** Hesap daveti gönderildi mi (mevcut öğrencilerde koordinatör sonradan gönderir). */
  invited: boolean;
}

const G24 = 'T-2024-GUZ';
const B24 = 'T-2024-BAHAR';
const G25 = 'T-2025-GUZ';
const B25 = 'T-2025-BAHAR';
const G26 = 'T-2026-GUZ';

const transcripts = (...terms: string[]) => terms.map((termId) => ({ kind: 'CAP_TRANSKRIPT', termId, status: 'APPROVED' as const }));

export const STUDENTS: SeedStudent[] = [
  {
    studentNo: '253302001',
    fullName: 'Ayşe Demirtaş',
    track: 'CAP',
    admissionTermId: G26,
    mainProgramId: 'P-EEM',
    scenario: 'yeni-kabul',
    description: 'Bu dönem kabul edildi; imzalı protokolünü yükledi (onay bekliyor), ders listesi henüz yok.',
    attempts: [],
    gano: [],
    documents: [{ kind: 'PROTOKOL', status: 'PENDING' }],
    invited: true,
  },
  {
    studentNo: '253302009',
    fullName: 'Büşra Yalçın',
    track: 'CAP',
    admissionTermId: G26,
    mainProgramId: 'P-EEM',
    scenario: 'donem-dersleri-onayda',
    description: 'Protokol ve ders listesi onaylı; bu dönem alacağı iki dersi girdi, onay bekliyor.',
    templateId: 'PT-CAP-EEM',
    attempts: [
      { code: '3301156', termId: G26, status: 'PENDING' },
      { code: '3301351', termId: G26, status: 'PENDING' },
    ],
    gano: [],
    documents: [{ kind: 'PROTOKOL', status: 'APPROVED' }, { kind: 'DERS_KAYIT_FORMU', termId: G26, status: 'PENDING' }],
    invited: true,
  },
  {
    studentNo: '253303008',
    fullName: 'Kerem Polat',
    track: 'YANDAL',
    admissionTermId: G26,
    mainProgramId: 'P-MAK',
    scenario: 'ders-listesi-onayda',
    description: 'Yan dal öğrencisi; alacağı dersleri katalogdan seçti, onay bekliyor.',
    pendingPlan: ['3301156', '3301256', '3301351', '3301352', '3301354', '3301454'],
    attempts: [],
    gano: [],
    documents: [{ kind: 'PROTOKOL', status: 'APPROVED' }],
    invited: true,
  },
  {
    studentNo: '243302013',
    fullName: 'Gizem Kurt',
    track: 'CAP',
    admissionTermId: G25,
    mainProgramId: 'P-EEM',
    scenario: 'normal-ilerleyen',
    description: 'İki dönemdir ders alıyor; bu dönemin iki dersi onaylı, dönem sonu notu bekleniyor. Bir dersi tekrar ediyor.',
    templateId: 'PT-CAP-EEM',
    attempts: [
      { code: '3301156', termId: G25, grade: 'BA' },
      { code: '3301351', termId: G25, grade: 'FF' },
      { code: '3301352', termId: B25, grade: 'CB' },
      { code: '3301452', termId: B25, grade: 'BB' },
      { code: '3301351', termId: G26 },
      { code: '3301454', termId: G26 },
    ],
    gano: [
      { termId: G25, gano: 3.2 },
      { termId: B25, gano: 3.15 },
    ],
    documents: [{ kind: 'PROTOKOL', status: 'APPROVED' }, ...transcripts(G25, B25)],
    invited: true,
  },
  {
    studentNo: '243303014',
    fullName: 'Onur Tekin',
    track: 'CAP',
    admissionTermId: G25,
    mainProgramId: 'P-MAK',
    scenario: 'gno-ilk-dusus',
    description: 'Makine Müh.; ana dal GNO 2,60: ilk düşüş, uyarı (ÇAP Yön. m.9/1-e).',
    templateId: 'PT-CAP-MAK',
    attempts: [
      { code: '3301156', termId: G25, grade: 'CC' },
      { code: '3301256', termId: B25, grade: 'CC' },
    ],
    gano: [
      { termId: G25, gano: 2.8 },
      { termId: B25, gano: 2.6 },
    ],
    documents: [{ kind: 'PROTOKOL', status: 'APPROVED' }, ...transcripts(G25, B25)],
    invited: true,
  },
  {
    studentNo: '243302015',
    fullName: 'Hakan Doğan',
    track: 'CAP',
    admissionTermId: G25,
    mainProgramId: 'P-EEM',
    scenario: 'gno-ikinci-dusus',
    description: 'Ana dal GNO iki dönem üst üste 2,72 altında: kayıt silme uyarısı.',
    templateId: 'PT-CAP-EEM',
    attempts: [
      { code: '3301156', termId: G25, grade: 'CC' },
      { code: '3301351', termId: B25, grade: 'DC' },
    ],
    gano: [
      { termId: G25, gano: 2.6 },
      { termId: B25, gano: 2.65 },
    ],
    documents: [{ kind: 'PROTOKOL', status: 'APPROVED' }, ...transcripts(G25, B25)],
    invited: true,
  },
  {
    studentNo: '243302016',
    fullName: 'İrem Koç',
    track: 'CAP',
    admissionTermId: G25,
    mainProgramId: 'P-EEM',
    scenario: 'iki-donem-ders-yok',
    description: 'Mevcut öğrenci, geriye dönük girildi; iki dönem üst üste ders almadı. Hesap daveti henüz gönderilmedi.',
    templateId: 'PT-CAP-EEM',
    attempts: [],
    gano: [
      { termId: G25, gano: 3.05 },
      { termId: B25, gano: 3.0 },
    ],
    documents: [],
    invited: false,
  },
  {
    studentNo: '243303017',
    fullName: 'Tolga Arı',
    track: 'YANDAL',
    admissionTermId: G25,
    mainProgramId: 'P-MAK',
    scenario: 'yandal-ilerleyen',
    description: 'Yan dal öğrencisi; iki dönemde dört ders geçti.',
    templateId: 'PT-YANDAL',
    attempts: [
      { code: '3301156', termId: G25, grade: 'BB' },
      { code: '3301256', termId: G25, grade: 'CB' },
      { code: '3301351', termId: B25, grade: 'BA' },
      { code: '3301352', termId: B25, grade: 'CC' },
    ],
    gano: [
      { termId: G25, gano: 2.95 },
      { termId: B25, gano: 2.9 },
    ],
    documents: [{ kind: 'PROTOKOL', status: 'APPROVED' }, ...transcripts(G25, B25)],
    invited: true,
  },
  {
    studentNo: '233302020',
    fullName: 'Selin Aydın',
    track: 'YANDAL',
    admissionTermId: G24,
    mainProgramId: 'P-EEM',
    scenario: 'sertifikaya-hazir',
    description: 'Yan dal listesinin tamamını geçti, ana daldan mezun oldu: sertifika kararı bekliyor.',
    templateId: 'PT-YANDAL',
    attempts: [
      { code: '3301156', termId: G24, grade: 'BA' },
      { code: '3301256', termId: G24, grade: 'BB' },
      { code: '3301351', termId: B24, grade: 'BB' },
      { code: '3301352', termId: B24, grade: 'CB' },
      { code: '3301354', termId: G25, grade: 'BB' },
      { code: '3301452', termId: B25, grade: 'AA' },
      { code: '3301454', termId: B25, grade: 'CC' },
      { code: '3301455', termId: B25, grade: 'BA' },
    ],
    gano: [
      { termId: G25, gano: 3.05 },
      { termId: B25, gano: 3.1, mainGraduated: true },
    ],
    documents: [{ kind: 'PROTOKOL', status: 'APPROVED' }, ...transcripts(G24, B24, G25, B25)],
    invited: true,
  },
];

export const studentEmail = (studentNo: string) => `${studentNo}@ogrenci.selcuk.test`;
