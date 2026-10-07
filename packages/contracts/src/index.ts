import { z } from 'zod';

export const TRACK_TYPES = ['CAP', 'YANDAL'] as const;
export type TrackType = (typeof TRACK_TYPES)[number];

/** Panel yalnızca personel içindir (docs/KARARLAR.md K-1). */
export const ROLES = ['KOORDINATOR', 'DANISMAN', 'BOLUM_BASKANI', 'BIRIM', 'OIDB'] as const;
export type Role = (typeof ROLES)[number];

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

export const ENROLLMENT_STATUSES = ['ACTIVE', 'FROZEN', 'WITHDRAWN', 'REMOVED', 'COMPLETED'] as const;
export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number];

export const PROPOSALS = ['ASIL', 'YEDEK', 'RET'] as const;
export type Proposal = (typeof PROPOSALS)[number];

export const FINDING_DECISIONS = ['PENDING', 'CONFIRMED', 'DISMISSED'] as const;
export type FindingDecision = (typeof FINDING_DECISIONS)[number];

/** Kabul ve Ders Protokolü ile ders kayıt formundaki imzacılar (Esaslar m.3–4 ve formlar). */
export const APPROVAL_ROLES = ['OGRENCI_IMZA', 'ANA_DAL_DANISMANI', 'ANA_DAL_BOLUM_BASKANI', 'KOORDINATOR', 'HEDEF_BOLUM_BASKANI'] as const;
export type ApprovalRole = (typeof APPROVAL_ROLES)[number];

export const FORM_STATUSES = ['DRAFT', 'IN_APPROVAL', 'APPROVED', 'REJECTED', 'SUBMITTED', 'ENTERED', 'FILED'] as const;
export type FormStatus = (typeof FORM_STATUSES)[number];

export const LEAVE_REASONS = ['ERASMUS', 'FARABI', 'DERS_ACILMADI', 'DERS_CAKISMASI', 'DIGER'] as const;
export type LeaveReason = (typeof LEAVE_REASONS)[number];

export interface DocumentDef {
  key: string;
  label: string;
  source: string;
}

/**
 * Başvuru belgeleri. Hangilerinin zorunlu olduğu başvuru yoluna ve programa göre API'de belirlenir.
 * Kaynaklar: Uygulama Esasları m.1, ÖİDB 2026-27 duyurusu, MTF dilekçesi, TF 2025-26 bahar duyurusu.
 */
export const APPLICATION_DOCUMENTS: DocumentDef[] = [
  { key: 'DILEKCE', label: 'Başvuru dilekçesi', source: 'Uygulama Esasları m.1' },
  { key: 'TRANSKRIPT', label: 'Transkript', source: 'Uygulama Esasları m.1' },
  { key: 'OGRENCI_BELGESI', label: 'Güncel öğrenci belgesi', source: 'ÖİDB 2026-27 duyurusu' },
  {
    key: 'BASARI_BELGESI',
    label: 'Öğrenci işlerinden: başarısız dersi olmadığı, GNO ve ilk %20 başarı sırası belgesi',
    source: 'Uygulama Esasları m.1',
  },
  { key: 'YKS_SONUC', label: 'YKS sonuç belgesi (yerleştirme puanları dahil)', source: 'ÖİDB 2026-27 duyurusu; MTF dilekçesi' },
  { key: 'YKS_YERLESTIRME', label: 'YKS yerleştirme belgesi', source: 'MTF dilekçesi' },
  { key: 'YOK_SIRALAMA', label: 'Kayıt yılındaki YÖK başarı sıralaması belgesi', source: 'Yönerge m.5/1-e; TF 2025-26 bahar duyurusu' },
];

/** Kesin kayıt belgeleri. Yalnızca İİBF 2023-24 listesi incelendi; birimden birime değişebilir (KARARLAR K-8). */
export const REGISTRATION_DOCUMENTS: DocumentDef[] = [
  { key: 'KAYIT_DILEKCESI', label: 'Kayıt dilekçesi', source: 'İİBF 2023-24 kayıt duyurusu' },
  { key: 'NUFUS_FOTOKOPI', label: 'Nüfus cüzdanı fotokopisi', source: 'İİBF 2023-24 kayıt duyurusu' },
  { key: 'OGRENCI_KIMLIK', label: 'Öğrenci kimlik fotokopisi', source: 'İİBF 2023-24 kayıt duyurusu' },
  { key: 'OGRENCI_BELGESI', label: 'Yeni tarihli öğrenci belgesi', source: 'İİBF 2023-24 kayıt duyurusu' },
  { key: 'TRANSKRIPT', label: 'Yeni tarihli transkript', source: 'İİBF 2023-24 kayıt duyurusu' },
  { key: 'FOTOGRAF', label: '3 adet fotoğraf', source: 'İİBF 2023-24 kayıt duyurusu' },
  { key: 'DERS_PLANI', label: 'Ana dal ders planı (2 adet)', source: 'İİBF 2023-24 kayıt duyurusu' },
  { key: 'YONERGE', label: 'ÇAP / yan dal yönergesi çıktısı', source: 'İİBF 2023-24 kayıt duyurusu' },
];

export const LABELS = {
  track: { CAP: 'Çift Ana Dal', YANDAL: 'Yan Dal' } satisfies Record<TrackType, string>,
  role: {
    KOORDINATOR: 'Koordinatör',
    DANISMAN: 'Danışman',
    BOLUM_BASKANI: 'Bölüm Başkanı',
    BIRIM: 'Birim Öğrenci İşleri',
    OIDB: 'Öğrenci İşleri Daire Başkanlığı',
  } satisfies Record<Role, string>,
  application: {
    SUBMITTED: 'Başvuru alındı',
    INELIGIBLE: 'Koşulları sağlamıyor',
    WITHDRAWN: 'Geri çekildi',
    UNDER_REVIEW: 'Bölüm incelemesinde',
    PROPOSED: 'Kurul kararı bekleniyor',
    ACCEPTED: 'Kabul (asil)',
    WAITLISTED: 'Yedek',
    REJECTED: 'Ret',
    ENROLLED: 'Kesin kayıt yapıldı',
    NOT_ENROLLED: 'Kayıt yaptırılmadı',
  } satisfies Record<ApplicationStatus, string>,
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
    OGRENCI_IMZA: 'Öğrenci (ıslak imza)',
    ANA_DAL_DANISMANI: 'Ana dal danışmanı',
    ANA_DAL_BOLUM_BASKANI: 'Ana dal bölüm başkanı',
    KOORDINATOR: 'ÇAP / yan dal koordinatörü',
    HEDEF_BOLUM_BASKANI: 'ÇAP / yan dal bölüm başkanı',
  } satisfies Record<ApprovalRole, string>,
  form: {
    DRAFT: 'Taslak',
    IN_APPROVAL: 'Onayda',
    APPROVED: 'Onaylandı',
    REJECTED: 'Reddedildi',
    SUBMITTED: 'Öğrenci işlerine teslim edildi',
    ENTERED: "OBİS'e girildi",
    FILED: 'Aslı dosyada',
  } satisfies Record<FormStatus, string>,
  leave: {
    ERASMUS: 'Erasmus',
    FARABI: 'Farabi',
    DERS_ACILMADI: 'Ders açılmadı',
    DERS_CAKISMASI: 'Ders çakışması',
    DIGER: 'Diğer (haklı ve geçerli mazeret)',
  } satisfies Record<LeaveReason, string>,
};

const reason = z.string().trim().min(5, 'Gerekçe en az 5 karakter olmalı').max(1000);
const studentNo = z.string().trim().regex(/^\d{9}$/, 'Öğrenci numarası 9 haneli olmalı');

/** Birim öğrenci işlerinin şahsen gelen dilekçeyi panele girmesi (KARARLAR K-1). */
export const IntakeApplicationSchema = z.object({
  studentNo,
  offeringId: z.string().min(1),
  documentNo: z.string().trim().min(1, 'Evrak kayıt numarası girin').max(40),
  documentDate: z.coerce.date(),
  documents: z.array(z.string()).default([]),
  osymDocNo: z.string().trim().max(40).optional(),
  osymVerificationCode: z.string().trim().max(20).optional(),
  note: z.string().trim().max(1000).optional(),
});
export type IntakeApplicationInput = z.infer<typeof IntakeApplicationSchema>;

export const WithdrawSchema = z.object({ reason });

export const RegistrationSchema = z.object({
  documents: z.array(z.string()).default([]),
  note: z.string().trim().max(1000).optional(),
});

export const OfferingInputSchema = z.object({
  programId: z.string().min(1),
  termId: z.string().min(1),
  type: z.enum(TRACK_TYPES),
  quota: z.coerce.number().int().min(1).max(500),
  coordinatorUsername: z.string().min(1),
  sourceProgramIds: z.array(z.string()).default([]),
  firstYearIntake: z.coerce.number().int().min(1).max(2000).nullable().optional(),
  quotaJustification: z.string().trim().max(1000).optional(),
  poolCourses: z
    .array(z.object({ courseCode: z.string().trim().min(1), name: z.string().trim().min(1), ects: z.coerce.number().int().min(1).max(30) }))
    .optional(),
});
export type OfferingInput = z.infer<typeof OfferingInputSchema>;

export const OfferingPatchSchema = OfferingInputSchema.partial().extend({
  status: z.enum(['DRAFT', 'PUBLISHED', 'CLOSED']).optional(),
});

export const WindowInputSchema = z.object({
  termId: z.string().min(1),
  type: z.enum(TRACK_TYPES),
  opensAt: z.coerce.date(),
  closesAt: z.coerce.date(),
  announceAt: z.coerce.date().optional(),
  registrationDeadline: z.coerce.date().optional(),
  waitlistDeadline: z.coerce.date().optional(),
  courseRegistrationDeadline: z.coerce.date().optional(),
});
export type WindowInput = z.infer<typeof WindowInputSchema>;

export const RankingOverrideSchema = z.object({ proposal: z.enum(PROPOSALS), reason });

export const DecisionInputSchema = z.object({
  decisionDate: z.coerce.date(),
  decisionNo: z.string().trim().min(1).max(50),
});

export const FindingDecisionSchema = z.object({ decision: z.enum(['CONFIRMED', 'DISMISSED']), reason });

export const StartScanSchema = z.object({ termId: z.string().min(1), unitId: z.string().min(1).optional() });

export const ProtocolSaveSchema = z.object({ courseCodes: z.array(z.string()).min(1, 'En az bir ders seçin') });

export const CourseRegistrationSaveSchema = z.object({
  termId: z.string().min(1),
  courseCodes: z.array(z.string()).min(1, 'En az bir ders seçin'),
});

export const ApprovalDecisionSchema = z
  .object({ decision: z.enum(['APPROVED', 'REJECTED']), comment: z.string().trim().max(1000).optional() })
  .refine((v) => v.decision === 'APPROVED' || (v.comment?.length ?? 0) >= 5, {
    message: 'Ret için en az 5 karakterlik açıklama girin',
    path: ['comment'],
  });

export const LeaveSchema = z.object({ termId: z.string().min(1), reason: z.enum(LEAVE_REASONS), note: z.string().trim().max(1000).optional() });

export const RuleSetCreateSchema = z.object({
  type: z.enum(TRACK_TYPES),
  version: z.string().trim().min(3).max(40),
  effectiveFrom: z.coerce.date(),
  paramOverrides: z.record(z.string(), z.record(z.string(), z.unknown())).default({}),
  note: z.string().trim().max(1000).optional(),
});

export const AssignmentSchema = z.object({
  role: z.enum(ROLES),
  unitId: z.string().min(1).optional(),
  programId: z.string().min(1).optional(),
});

export const UserCreateSchema = z.object({
  username: z.string().trim().min(3).max(60).regex(/^[a-z0-9._-]+$/, 'Küçük harf, rakam, nokta, tire'),
  displayName: z.string().trim().min(3).max(120),
  email: z.string().trim().email(),
});
