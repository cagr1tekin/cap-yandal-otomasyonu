import { z } from 'zod';

export const TRACK_TYPES = ['CAP', 'YANDAL'] as const;
export type TrackType = (typeof TRACK_TYPES)[number];

/**
 * Roller (docs/KARARLAR.md K-12). Sistem yalnızca Bilgisayar Mühendisliği Bölümünün ÇAP / yan dal
 * sürecini kapsar; birim öğrenci işleri ve Öğrenci İşleri Daire Başkanlığı rolleri yoktur.
 * OGRENCI rolü atanmaz: personel rolü olmayan her hesap öğrenci hesabıdır.
 */
export const ROLES = ['OGRENCI', 'DANISMAN', 'KOORDINATOR', 'BOLUM_BASKANI'] as const;
export type Role = (typeof ROLES)[number];
export const STAFF_ROLES = ['DANISMAN', 'KOORDINATOR', 'BOLUM_BASKANI'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const APPLICATION_STATUSES = [
  'SUBMITTED',
  'INELIGIBLE',
  'WITHDRAWN',
  'UNDER_REVIEW',
  'PROPOSED',
  'ACCEPTED',
  'WAITLISTED',
  'REJECTED',
  'ENROLLED',
  'NOT_ENROLLED',
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

/** Öğrencinin kendi girdiği bilgilerin koordinatörce belgeyle karşılaştırılması. */
export const VERIFICATION_STATUSES = ['PENDING', 'VERIFIED', 'MISMATCH'] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const ENROLLMENT_STATUSES = ['ACTIVE', 'FROZEN', 'WITHDRAWN', 'REMOVED', 'COMPLETED'] as const;
export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number];

export const PROPOSALS = ['ASIL', 'YEDEK', 'RET'] as const;
export type Proposal = (typeof PROPOSALS)[number];

export const FINDING_DECISIONS = ['PENDING', 'CONFIRMED', 'DISMISSED'] as const;
export type FindingDecision = (typeof FINDING_DECISIONS)[number];

/** Formlardaki imzacılar (Bölüm ÇAP Rehberi 2025; protokol ve ders kayıt formları). */
export const APPROVAL_ROLES = ['OGRENCI', 'ANA_DAL_DANISMANI', 'ANA_DAL_BOLUM_BASKANI', 'KOORDINATOR', 'CAP_BOLUM_BASKANI'] as const;
export type ApprovalRole = (typeof APPROVAL_ROLES)[number];

export const APPROVAL_SUBJECTS = ['PROTOCOL', 'COURSE_REG', 'EXEMPTION'] as const;
export type ApprovalSubject = (typeof APPROVAL_SUBJECTS)[number];

/**
 * Hangi formu kim imzalar:
 * - Kabul ve Ders Protokolü: 5 imza, 4 nüsha (Rehber "Asil öğrenci kayıtları"; protokol formu).
 * - Ders Kayıt Formu (FORM01): öğrenci, ana dal danışmanı, koordinatör; 3 nüsha.
 * - Özel Şartlı Derslerin Muafiyeti Formu: öğrenci, ana dal danışmanı, koordinatör; 2 nüsha.
 */
export const SIGNERS: Record<ApprovalSubject, ApprovalRole[]> = {
  PROTOCOL: ['OGRENCI', 'ANA_DAL_DANISMANI', 'ANA_DAL_BOLUM_BASKANI', 'KOORDINATOR', 'CAP_BOLUM_BASKANI'],
  COURSE_REG: ['OGRENCI', 'ANA_DAL_DANISMANI', 'KOORDINATOR'],
  EXEMPTION: ['OGRENCI', 'ANA_DAL_DANISMANI', 'KOORDINATOR'],
};

export const FORM_STATUSES = ['DRAFT', 'IN_APPROVAL', 'APPROVED', 'REJECTED'] as const;
export type FormStatus = (typeof FORM_STATUSES)[number];

export const LEAVE_REASONS = ['ERASMUS', 'FARABI', 'DERS_ACILMADI', 'DERS_CAKISMASI', 'DIGER'] as const;
export type LeaveReason = (typeof LEAVE_REASONS)[number];

export const COURSE_KINDS = ['ZORUNLU', 'TEKNIK_SECMELI', 'SOSYAL_SECMELI'] as const;
export type CourseKind = (typeof COURSE_KINDS)[number];

export const PROTOCOL_ITEM_KINDS = ['COURSE', 'ELECTIVE_SLOT'] as const;
export type ProtocolItemKind = (typeof PROTOCOL_ITEM_KINDS)[number];

export const PROTOCOL_ITEM_STATUSES = ['PENDING', 'PASSED', 'FAILED', 'EXEMPT'] as const;
export type ProtocolItemStatus = (typeof PROTOCOL_ITEM_STATUSES)[number];

/** Harf notları ve katsayıları (Eğitim-Öğretim ve Sınav Yönetmeliği m.13). G: kredisiz derste geçer, M: muaf. */
export const GRADES = ['AA', 'BA', 'BB', 'CB', 'CC', 'DC', 'FF', 'F', 'G', 'K'] as const;
export type Grade = (typeof GRADES)[number];
export const GRADE_POINTS: Record<Grade, number | null> = { AA: 4, BA: 3.5, BB: 3, CB: 2.5, CC: 2, DC: 1.5, FF: 0, F: 0, G: null, K: null };
/** DC şartlı geçer: dönem ortalaması 2,50 ve üzeriyse başarılı sayılır (m.13/3-b); koordinatör ayrıca işaretler. */
export const PASSING_GRADES: Grade[] = ['AA', 'BA', 'BB', 'CB', 'CC', 'G'];

export interface DocumentDef {
  key: DocumentKind;
  label: string;
  source: string;
}

export const DOCUMENT_KINDS = ['TRANSKRIPT', 'BASARI_BELGESI', 'YKS_BELGESI', 'DONEM_TRANSKRIPTI', 'DIGER'] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

/**
 * Başvuruda istenen belgeler (Bölüm ÇAP Rehberi 2025, "Başvuru"). Dilekçeyi sistem üretir.
 * Transkript ve %20 belgesi fakülte içi bölümlerden gelen öğrencilerde zorunlu değildir.
 */
export const APPLICATION_DOCUMENTS: DocumentDef[] = [
  { key: 'TRANSKRIPT', label: 'Transkript', source: 'ÇAP Rehberi 2025, Başvuru (fakülte içi bölümlerde gerekmez)' },
  {
    key: 'BASARI_BELGESI',
    label: 'Sınıfında başarı sıralamasının ilk %20’lik diliminde olduğunu gösterir belge',
    source: 'ÇAP Rehberi 2025, Başvuru (fakülte içi bölümlerde gerekmez)',
  },
  {
    key: 'YKS_BELGESI',
    label: 'Kayıt yılındaki YÖK başarı sıralamasını ve puanını gösterir belge',
    source: 'ÇAP Rehberi 2025, Başvuru; ÇAP Yön. m.5/1-e',
  },
];

export const UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
export const UPLOAD_MIME = ['application/pdf', 'image/jpeg', 'image/png'] as const;

export const LABELS = {
  track: { CAP: 'Çift Ana Dal', YANDAL: 'Yan Dal' } satisfies Record<TrackType, string>,
  role: {
    OGRENCI: 'Öğrenci',
    DANISMAN: 'Danışman',
    KOORDINATOR: 'ÇAP / Yan Dal Koordinatörü',
    BOLUM_BASKANI: 'Bölüm Başkanı',
  } satisfies Record<Role, string>,
  application: {
    SUBMITTED: 'Başvuru alındı',
    INELIGIBLE: 'Koşulları sağlamıyor',
    WITHDRAWN: 'Geri çekildi',
    UNDER_REVIEW: 'Komisyon incelemesinde',
    PROPOSED: 'Kurul kararı bekleniyor',
    ACCEPTED: 'Kabul (asil)',
    WAITLISTED: 'Yedek',
    REJECTED: 'Ret',
    ENROLLED: 'Kesin kayıt yapıldı',
    NOT_ENROLLED: 'Kayıt yaptırılmadı',
  } satisfies Record<ApplicationStatus, string>,
  verification: {
    PENDING: 'Doğrulama bekliyor',
    VERIFIED: 'Belgeyle doğrulandı',
    MISMATCH: 'Belgeyle uyuşmuyor',
  } satisfies Record<VerificationStatus, string>,
  enrollment: {
    ACTIVE: 'Etkin',
    FROZEN: 'Dondurulmuş',
    WITHDRAWN: 'Kendi isteğiyle ayrıldı',
    REMOVED: 'Kaydı silindi',
    COMPLETED: 'Tamamlandı',
  } satisfies Record<EnrollmentStatus, string>,
  proposal: { ASIL: 'Asil', YEDEK: 'Yedek', RET: 'Ret' } satisfies Record<Proposal, string>,
  finding: { PENDING: 'Karar bekliyor', CONFIRMED: 'Onaylandı', DISMISSED: 'Reddedildi' } satisfies Record<FindingDecision, string>,
  approvalRole: {
    OGRENCI: 'Öğrenci',
    ANA_DAL_DANISMANI: 'Ana dal danışmanı',
    ANA_DAL_BOLUM_BASKANI: 'Ana dal bölüm başkanı',
    KOORDINATOR: 'ÇAP / yan dal koordinatörü',
    CAP_BOLUM_BASKANI: 'ÇAP / yan dal bölüm başkanı',
  } satisfies Record<ApprovalRole, string>,
  subject: {
    PROTOCOL: 'Kabul ve Ders Protokolü',
    COURSE_REG: 'Ders kayıt formu',
    EXEMPTION: 'Özel şartlı ders muafiyeti formu',
  } satisfies Record<ApprovalSubject, string>,
  form: {
    DRAFT: 'Taslak',
    IN_APPROVAL: 'İmzada',
    APPROVED: 'İmzalar tamam',
    REJECTED: 'Reddedildi',
  } satisfies Record<FormStatus, string>,
  leave: {
    ERASMUS: 'Erasmus',
    FARABI: 'Farabi',
    DERS_ACILMADI: 'Ders açılmadı',
    DERS_CAKISMASI: 'Ders çakışması',
    DIGER: 'Diğer (haklı ve geçerli mazeret)',
  } satisfies Record<LeaveReason, string>,
  courseKind: {
    ZORUNLU: 'Zorunlu',
    TEKNIK_SECMELI: 'Teknik seçmeli',
    SOSYAL_SECMELI: 'Sosyal seçmeli',
  } satisfies Record<CourseKind, string>,
  itemStatus: {
    PENDING: 'Alınacak',
    PASSED: 'Geçti',
    FAILED: 'Kaldı',
    EXEMPT: 'Muaf',
  } satisfies Record<ProtocolItemStatus, string>,
  document: {
    TRANSKRIPT: 'Transkript',
    BASARI_BELGESI: 'İlk %20 başarı belgesi',
    YKS_BELGESI: 'YKS başarı sırası ve puan belgesi',
    DONEM_TRANSKRIPTI: 'Dönem sonu transkripti',
    DIGER: 'Diğer',
  } satisfies Record<DocumentKind, string>,
};

const reason = z.string().trim().min(5, 'Gerekçe en az 5 karakter olmalı').max(1000);
const studentNo = z.string().trim().regex(/^\d{9}$/, 'Öğrenci numarası 9 haneli olmalı');
const optionalNumber = (schema: z.ZodNumber) =>
  z.preprocess((v) => (v === '' || v === null || v === undefined ? null : v), schema.nullable());

/**
 * Öğrencinin kendi girdiği akademik bilgiler. OBİS bağlantısı yoktur (K-12);
 * bilgiler başvuruda yüklenen belgelerle koordinatörce doğrulanır.
 */
export const StudentProfileSchema = z
  .object({
    studentNo,
    fullName: z.string().trim().min(3, 'Ad soyad girin').max(120),
    email: z.string().trim().email('Geçerli bir e-posta girin'),
    phone: z.string().trim().max(20).optional(),
    programId: z.string().min(1, 'Ana dal bölümünüzü seçin'),
    entryYear: z.coerce.number().int().min(2015, 'Kayıt yılı geçersiz').max(2100),
    semesterNo: z.coerce.number().int().min(1).max(12),
    gano: z.coerce.number().min(0, 'GNO 0–4 arasında olmalı').max(4, 'GNO 0–4 arasında olmalı'),
    completedAllCourses: z.coerce.boolean(),
    classRank: optionalNumber(z.coerce.number().int().min(1)),
    classSize: optionalNumber(z.coerce.number().int().min(1)),
    entryScore: optionalNumber(z.coerce.number().min(100).max(600)),
    successRank: optionalNumber(z.coerce.number().int().min(1)),
    advisorUsername: z.string().trim().max(60).optional(),
  })
  .refine((v) => (v.classRank === null) === (v.classSize === null), { message: 'Sınıf sırası ve sınıf mevcudu birlikte girilmeli', path: ['classRank'] })
  .refine((v) => v.classRank === null || v.classSize === null || v.classRank <= v.classSize, { message: 'Sınıf sırası mevcuttan büyük olamaz', path: ['classRank'] });
export type StudentProfileInput = z.infer<typeof StudentProfileSchema>;

export const ApplySchema = z.object({
  offeringId: z.string().min(1),
  declaration: z.literal(true, { errorMap: () => ({ message: 'Bilgilerin doğruluğunu beyan etmelisiniz' }) }),
});

export const WithdrawSchema = z.object({ reason });

export const VerifySchema = z.object({
  status: z.enum(['VERIFIED', 'MISMATCH']),
  note: z.string().trim().max(1000).optional(),
});

export const OfferingInputSchema = z.object({
  termId: z.string().min(1),
  type: z.enum(TRACK_TYPES),
  quota: z.coerce.number().int().min(1).max(200),
  sourceProgramIds: z.array(z.string()).default([]),
  firstYearIntake: optionalNumber(z.coerce.number().int().min(1).max(2000)).optional(),
  quotaJustification: z.string().trim().max(1000).optional(),
  opensAt: z.coerce.date(),
  closesAt: z.coerce.date(),
  announceAt: z.coerce.date().optional(),
  registrationDeadline: z.coerce.date().optional(),
  waitlistDeadline: z.coerce.date().optional(),
});
export type OfferingInput = z.infer<typeof OfferingInputSchema>;

export const OfferingPatchSchema = OfferingInputSchema.partial().extend({
  status: z.enum(['DRAFT', 'PUBLISHED', 'CLOSED']).optional(),
});

export const RankingOverrideSchema = z.object({ proposal: z.enum(PROPOSALS), reason });

export const DecisionInputSchema = z.object({
  decisionDate: z.coerce.date(),
  decisionNo: z.string().trim().min(1).max(50),
});

export const FindingDecisionSchema = z.object({ decision: z.enum(['CONFIRMED', 'DISMISSED']), reason });

export const StartScanSchema = z.object({ termId: z.string().min(1) });

const templateItem = z.object({
  kind: z.enum(PROTOCOL_ITEM_KINDS),
  code: z.string().trim().max(20).nullable().optional(),
  name: z.string().trim().min(2).max(160),
  ects: z.coerce.number().int().min(1).max(40),
  semester: z.coerce.number().int().min(1).max(8),
});

const templateCondition = z.object({
  no: z.coerce.number().int().min(1),
  sourceCourseCode: z.string().trim().min(1).max(20),
  sourceCourseName: z.string().trim().min(2).max(160),
  targetCourseCode: z.string().trim().min(1).max(20),
  note: z.string().trim().max(300).nullable().optional(),
});

export const TemplateSaveSchema = z.object({
  type: z.enum(TRACK_TYPES),
  sourceProgramId: z.string().min(1).nullable(),
  title: z.string().trim().min(3).max(160),
  commonEcts: z.coerce.number().int().min(0).max(240),
  items: z.array(templateItem).min(1, 'En az bir ders ekleyin'),
  conditions: z.array(templateCondition).default([]),
});
export type TemplateSaveInput = z.infer<typeof TemplateSaveSchema>;

/** Yan dalda öğrencinin planı havuzdan seçilir; ÇAP'ta şablonun tamamı kopyalanır. */
export const ProtocolCreateSchema = z.object({ itemIds: z.array(z.string()).optional() });

export const CourseRegistrationSaveSchema = z.object({
  termId: z.string().min(1),
  items: z
    .array(z.object({ protocolCourseId: z.string().min(1), courseCode: z.string().trim().max(20).optional() }))
    .min(1, 'En az bir ders seçin'),
});

export const GradeEntrySchema = z.object({
  grades: z.array(z.object({ itemId: z.string().min(1), grade: z.enum(GRADES), passed: z.coerce.boolean() })).min(1),
});

export const ExemptionCreateSchema = z.object({
  conditionId: z.string().min(1),
  sourceGrade: z.enum(GRADES),
  sourceTerm: z.string().trim().min(3).max(40),
});

export const TermRecordSchema = z.object({
  termId: z.string().min(1),
  mainGano: z.coerce.number().min(0).max(4),
  mainFrozen: z.coerce.boolean().default(false),
});

export const ApprovalDecisionSchema = z
  .object({ decision: z.enum(['APPROVED', 'REJECTED']), comment: z.string().trim().max(1000).optional() })
  .refine((v) => v.decision === 'APPROVED' || (v.comment?.length ?? 0) >= 5, {
    message: 'Ret için en az 5 karakterlik açıklama girin',
    path: ['comment'],
  });

export const LeaveSchema = z.object({ termId: z.string().min(1), reason: z.enum(LEAVE_REASONS), note: z.string().trim().max(1000).optional() });

export const CompleteSchema = z.object({ mainGano: z.coerce.number().min(0).max(4) });

export const RuleSetCreateSchema = z.object({
  type: z.enum(TRACK_TYPES),
  version: z.string().trim().min(3).max(40),
  effectiveFrom: z.coerce.date(),
  paramOverrides: z.record(z.string(), z.record(z.string(), z.unknown())).default({}),
  note: z.string().trim().max(1000).optional(),
});

export const AssignmentSchema = z.object({
  role: z.enum(STAFF_ROLES),
  programId: z.string().min(1).optional(),
});

export const UserCreateSchema = z.object({
  username: z.string().trim().min(3).max(60).regex(/^[a-z0-9._-]+$/, 'Küçük harf, rakam, nokta, tire'),
  displayName: z.string().trim().min(3).max(120),
  email: z.string().trim().email(),
});

/** Bilgisayar Mühendisliğinin yıllara göre taban puanı ve başarı sırası şartı (KR-ÇAP-03b, KR-ÇAP-04). */
export const YearStatSchema = z.object({
  year: z.coerce.number().int().min(2015).max(2100),
  baseScore: z.coerce.number().min(100).max(600),
  successRankLimit: optionalNumber(z.coerce.number().int().min(1)),
});
