import { z } from 'zod';

export const TRACK_TYPES = ['CAP', 'YANDAL'] as const;
export type TrackType = (typeof TRACK_TYPES)[number];

export const ROLES = ['OGRENCI', 'KOORDINATOR', 'DANISMAN', 'BOLUM_BASKANI', 'BIRIM', 'OIDB'] as const;
export type Role = (typeof ROLES)[number];

export const APPLICATION_STATUSES = [
  'SUBMITTED',
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

export const LABELS = {
  track: { CAP: 'Çift Ana Dal', YANDAL: 'Yan Dal' } satisfies Record<TrackType, string>,
  role: {
    OGRENCI: 'Öğrenci',
    KOORDINATOR: 'Koordinatör',
    DANISMAN: 'Danışman',
    BOLUM_BASKANI: 'Bölüm Başkanı',
    BIRIM: 'Birim Öğrenci İşleri',
    OIDB: 'Öğrenci İşleri Daire Başkanlığı',
  } satisfies Record<Role, string>,
  application: {
    SUBMITTED: 'Başvuru alındı',
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
};

const reason = z.string().trim().min(5, 'Gerekçe en az 5 karakter olmalı').max(1000);

export const CreateApplicationSchema = z.object({
  offeringId: z.string().min(1),
  osymDocNo: z.string().trim().max(40).optional(),
  osymVerificationCode: z.string().trim().max(20).optional(),
});
export type CreateApplicationInput = z.infer<typeof CreateApplicationSchema>;

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
});
export type WindowInput = z.infer<typeof WindowInputSchema>;

export const RankingOverrideSchema = z.object({
  proposal: z.enum(PROPOSALS),
  reason,
});

export const DecisionInputSchema = z.object({
  decisionDate: z.coerce.date(),
  decisionNo: z.string().trim().min(1).max(50),
});

export const FindingDecisionSchema = z.object({
  decision: z.enum(['CONFIRMED', 'DISMISSED']),
  reason,
});

export const StartScanSchema = z.object({
  termId: z.string().min(1),
  unitId: z.string().min(1).optional(),
});

export const MinorPlanSchema = z.object({
  poolCourseIds: z.array(z.string()).min(1, 'En az bir ders seçin'),
});

export const WithdrawalSchema = z.object({ reason });

export const RuleSetCreateSchema = z.object({
  type: z.enum(TRACK_TYPES),
  version: z.string().trim().min(3).max(40),
  effectiveFrom: z.coerce.date(),
  /** Kural kodu → yeni parametreler (yalnızca değişenler). */
  paramOverrides: z.record(z.string(), z.record(z.string(), z.unknown())).default({}),
  note: z.string().trim().max(1000).optional(),
});

export const OsymVerifySchema = z.object({
  docNo: z.string().trim().min(1),
  verificationCode: z.string().trim().min(1),
});
