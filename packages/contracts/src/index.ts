import { z } from 'zod';

/**
 * Bilgisayar Mühendisliği ÇAP / YDP takip sistemi — ortak tanımlar.
 * Tek kaynak: koordinatörün sistem çerçevesi e-postası (docs/KARARLAR.md K-18).
 */

export const TRACK_TYPES = ['CAP', 'YANDAL'] as const;
export type TrackType = (typeof TRACK_TYPES)[number];

/** Üç giriş türü; başka rol yok. */
export const ROLES = ['KOORDINATOR', 'OGRENCI', 'BOLUM_BASKANI'] as const;
export type Role = (typeof ROLES)[number];

export const STUDENT_STATUSES = ['ACTIVE', 'FROZEN', 'GRADUATED', 'CERTIFIED', 'WITHDRAWN', 'REMOVED'] as const;
export type StudentStatus = (typeof STUDENT_STATUSES)[number];

/** Öğrencinin girdiği her kaydın onay durumu. Reddedilen ve iptal edilen kayıt silinmez. */
export const REVIEW_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

/** Kaydın nereden geldiği: ileride OBİS bağlantısı IMPORT/OBIS kaynağıyla aynı yoldan yazar. */
export const RECORD_SOURCES = ['STUDENT', 'COORDINATOR', 'BACKFILL', 'IMPORT'] as const;
export type RecordSource = (typeof RECORD_SOURCES)[number];

export const PLAN_ITEM_KINDS = ['COURSE', 'ELECTIVE_SLOT'] as const;
export type PlanItemKind = (typeof PLAN_ITEM_KINDS)[number];

/** Ders listesindeki bir dersin görünen durumu (e-postadaki sözcüklerle). */
export const COURSE_STATES = ['PLANLANDI', 'ALINDI', 'GECTI', 'KALDI', 'MUAF', 'CIKARILDI'] as const;
export type CourseState = (typeof COURSE_STATES)[number];

export const ATTEMPT_RESULTS = ['TAKEN', 'PASSED', 'FAILED'] as const;
export type AttemptResult = (typeof ATTEMPT_RESULTS)[number];

export const COURSE_KINDS = ['ZORUNLU', 'TEKNIK_SECMELI', 'SOSYAL_SECMELI'] as const;
export type CourseKind = (typeof COURSE_KINDS)[number];

export const DOCUMENT_KINDS = [
  'PROTOKOL',
  'DERS_KAYIT_FORMU',
  'MUAFIYET_FORMU',
  'CAP_TRANSKRIPT',
  'ANADAL_TRANSKRIPT',
  'YK_KARARI',
  'RESMI_YAZI',
  'DIGER',
] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];
/** Koordinatörün yükleyebildiği resmî yazılar; öğrenci bu türleri yükleyemez. */
export const STAFF_ONLY_DOCUMENTS: DocumentKind[] = ['YK_KARARI', 'RESMI_YAZI'];
/** Döneme bağlı belgeler. */
export const TERM_DOCUMENTS: DocumentKind[] = ['DERS_KAYIT_FORMU', 'CAP_TRANSKRIPT', 'ANADAL_TRANSKRIPT'];

export const REQUEST_STATUSES = ['OPEN', 'UPLOADED', 'APPROVED', 'REJECTED', 'CANCELLED'] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const GANO_SOURCES = ['TRANSKRIPT', 'OGRENCI_ISLERI', 'OBIS', 'DIGER'] as const;
export type GanoSource = (typeof GANO_SOURCES)[number];

export const DECISION_TYPES = ['MEZUNIYET', 'SERTIFIKA', 'KAYIT_SILME', 'AYRILMA', 'DONDURMA', 'ETKINLESTIRME'] as const;
export type DecisionType = (typeof DECISION_TYPES)[number];

export const LEAVE_REASONS = ['ERASMUS', 'FARABI', 'DERS_ACILMADI', 'DERS_CAKISMASI', 'DIGER'] as const;
export type LeaveReason = (typeof LEAVE_REASONS)[number];

export const IMPORT_KINDS = ['COURSES', 'STUDENTS', 'ATTEMPTS'] as const;
export type ImportKind = (typeof IMPORT_KINDS)[number];

/** Harf notları ve katsayıları (Eğitim-Öğretim ve Sınav Yönetmeliği m.13). G: kredisiz derste geçer, K: kalır. */
export const GRADES = ['AA', 'BA', 'BB', 'CB', 'CC', 'DC', 'FF', 'F', 'G', 'K'] as const;
export type Grade = (typeof GRADES)[number];
export const GRADE_POINTS: Record<Grade, number | null> = { AA: 4, BA: 3.5, BB: 3, CB: 2.5, CC: 2, DC: 1.5, FF: 0, F: 0, G: null, K: null };
export const PASSING_GRADES: Grade[] = ['AA', 'BA', 'BB', 'CB', 'CC', 'G'];
/** DC şartlı geçer: başarılı sayılıp sayılmadığını koordinatör onayda işaretler (m.13/3-b). */
export const CONDITIONAL_GRADES: Grade[] = ['DC'];

export const ALLOWED_UPLOAD_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;
/** Ayarlar sayfasındaki değerlerin varsayılanları (yönerge dışı sistem ayarları). */
export const DEFAULT_SETTINGS = {
  uploadMaxMb: 10,
  uploadTypes: ['application/pdf', 'image/jpeg', 'image/png'] as string[],
  messageMaxLength: 4000,
};
export type Settings = typeof DEFAULT_SETTINGS;
/** Ayarlarda girilebilecek en büyük dosya boyutu (sunucunun sabit üst sınırı). */
export const HARD_UPLOAD_LIMIT_MB = 20;

export const LABELS = {
  track: { CAP: 'Çift Ana Dal (ÇAP)', YANDAL: 'Yan Dal (YDP)' } satisfies Record<TrackType, string>,
  trackShort: { CAP: 'ÇAP', YANDAL: 'YDP' } satisfies Record<TrackType, string>,
  role: { KOORDINATOR: 'Koordinatör', OGRENCI: 'Öğrenci', BOLUM_BASKANI: 'Bölüm Başkanı' } satisfies Record<Role, string>,
  studentStatus: {
    ACTIVE: 'Etkin',
    FROZEN: 'Dondurulmuş',
    GRADUATED: 'Mezun (ÇAP diploması)',
    CERTIFIED: 'Sertifika aldı',
    WITHDRAWN: 'Kendi isteğiyle ayrıldı',
    REMOVED: 'Kaydı silindi',
  } satisfies Record<StudentStatus, string>,
  review: { PENDING: 'Onay bekliyor', APPROVED: 'Onaylandı', REJECTED: 'Reddedildi', CANCELLED: 'İptal edildi' } satisfies Record<ReviewStatus, string>,
  source: { STUDENT: 'Öğrenci girdi', COORDINATOR: 'Koordinatör girdi', BACKFILL: 'Geriye dönük giriş', IMPORT: 'Dışarıdan aktarım' } satisfies Record<RecordSource, string>,
  courseState: { PLANLANDI: 'Planlandı', ALINDI: 'Alındı', GECTI: 'Geçti', KALDI: 'Kaldı', MUAF: 'Muaf', CIKARILDI: 'Çıkarıldı' } satisfies Record<CourseState, string>,
  attemptResult: { TAKEN: 'Alındı (not yok)', PASSED: 'Geçti', FAILED: 'Kaldı' } satisfies Record<AttemptResult, string>,
  courseKind: { ZORUNLU: 'Zorunlu', TEKNIK_SECMELI: 'Teknik seçmeli', SOSYAL_SECMELI: 'Sosyal seçmeli' } satisfies Record<CourseKind, string>,
  document: {
    PROTOKOL: 'Kabul ve Ders Protokolü (imzalı)',
    DERS_KAYIT_FORMU: 'Ders kayıt formu (imzalı)',
    MUAFIYET_FORMU: 'Özel şartlı ders muafiyeti formu',
    CAP_TRANSKRIPT: 'ÇAP / YDP not belgesi (transkript)',
    ANADAL_TRANSKRIPT: 'Ana dal transkripti',
    YK_KARARI: 'Yönetim kurulu yazısı',
    RESMI_YAZI: 'Resmî yazı',
    DIGER: 'Diğer',
  } satisfies Record<DocumentKind, string>,
  request: { OPEN: 'Bekliyor', UPLOADED: 'Yüklendi', APPROVED: 'Onaylandı', REJECTED: 'Reddedildi', CANCELLED: 'İptal edildi' } satisfies Record<RequestStatus, string>,
  ganoSource: { TRANSKRIPT: 'Transkript', OGRENCI_ISLERI: 'Öğrenci işleri', OBIS: 'OBİS', DIGER: 'Diğer' } satisfies Record<GanoSource, string>,
  decision: {
    MEZUNIYET: 'Mezuniyet (ÇAP diploması)',
    SERTIFIKA: 'Yan dal sertifikası',
    KAYIT_SILME: 'Kayıt silme',
    AYRILMA: 'Kendi isteğiyle ayrılma',
    DONDURMA: 'Kayıt dondurma',
    ETKINLESTIRME: 'Kaydı yeniden etkinleştirme',
  } satisfies Record<DecisionType, string>,
  leave: { ERASMUS: 'Erasmus', FARABI: 'Farabi', DERS_ACILMADI: 'Ders açılmadı', DERS_CAKISMASI: 'Ders çakışması', DIGER: 'Diğer (haklı ve geçerli mazeret)' } satisfies Record<LeaveReason, string>,
  importKind: { COURSES: 'Ders kataloğu', STUDENTS: 'Öğrenciler', ATTEMPTS: 'Geçmiş dersler ve notlar' } satisfies Record<ImportKind, string>,
};

const reason = z.string().trim().min(5, 'Gerekçe en az 5 karakter olmalı').max(1000);
const studentNo = z.string().trim().regex(/^\d{9}$/, 'Öğrenci numarası 9 haneli olmalı');
const courseCode = z.string().trim().regex(/^[A-Z0-9]{3,12}$/i, 'Ders kodu 3–12 harf/rakam olmalı').transform((v) => v.toUpperCase());
const termId = z.string().trim().regex(/^T-\d{4}-(GUZ|BAHAR)$/, 'Dönem geçersiz');
const name = z.string().trim().min(3).max(120);
const optionalText = (max: number) => z.string().trim().max(max).optional().transform((v) => v || undefined);

export const ReasonSchema = z.object({ reason });

// ---------------- Kullanıcılar ve öğrenciler ----------------

export const StaffCreateSchema = z.object({
  username: z.string().trim().min(3).max(60).regex(/^[a-z0-9._-]+$/, 'Küçük harf, rakam, nokta, tire'),
  displayName: name,
  email: z.string().trim().email(),
  role: z.enum(['KOORDINATOR', 'BOLUM_BASKANI']),
});

export const StudentCreateSchema = z.object({
  studentNo,
  fullName: name,
  schoolEmail: z.string().trim().toLowerCase().email('Okul e-postası geçersiz'),
  track: z.enum(TRACK_TYPES),
  admissionTermId: termId,
  mainProgramId: z.string().trim().min(1).optional(),
  /** Mevcut öğrenci (geriye dönük giriş yapılacak): hesap daveti gönderilmeden de eklenebilir. */
  sendInvite: z.boolean().default(true),
  commonEcts: z.coerce.number().int().min(0).max(240).default(0),
});
export type StudentCreateInput = z.infer<typeof StudentCreateSchema>;

export const StudentUpdateSchema = z.object({
  fullName: name.optional(),
  schoolEmail: z.string().trim().toLowerCase().email().optional(),
  track: z.enum(TRACK_TYPES).optional(),
  admissionTermId: termId.optional(),
  mainProgramId: z.string().trim().min(1).nullable().optional(),
  commonEcts: z.coerce.number().int().min(0).max(240).optional(),
  reason,
});

/** Öğrencinin kendi değiştirebildiği tek bilgi: iletişim telefonu. */
export const ContactSchema = z.object({ phone: z.string().trim().regex(/^[0-9 +()-]{0,20}$/, 'Telefon geçersiz').optional() });

// ---------------- Katalog ----------------

export const CourseSchema = z.object({
  code: courseCode,
  name: name,
  ects: z.coerce.number().int().min(0).max(60),
  credit: z.coerce.number().int().min(0).max(20).nullable().optional(),
  semester: z.coerce.number().int().min(1).max(8),
  kind: z.enum(COURSE_KINDS),
});
export type CourseInput = z.infer<typeof CourseSchema>;
export const CourseUpdateSchema = CourseSchema.omit({ code: true }).partial().extend({ active: z.boolean().optional(), reason });

export const CourseRequestSchema = z.object({
  code: z.string().trim().max(12).optional().transform((v) => v || undefined),
  name: name,
  note: z.string().trim().min(5, 'Neden gerektiğini kısaca yazın').max(1000),
});
export const CourseRequestDecisionSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  note: optionalText(1000),
  /** Onayda kataloğa eklenen ya da eşleştirilen ders */
  courseCode: courseCode.optional(),
  addToPlan: z.boolean().default(true),
});

export const TermSchema = z.object({
  year: z.string().regex(/^\d{4}-\d{4}$/, 'Akademik yıl 2026-2027 biçiminde olmalı'),
  season: z.enum(['GUZ', 'BAHAR']),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
});

export const SettingsSchema = z.object({
  uploadMaxMb: z.coerce.number().int().min(1).max(HARD_UPLOAD_LIMIT_MB),
  uploadTypes: z.array(z.enum(ALLOWED_UPLOAD_TYPES)).min(1),
  messageMaxLength: z.coerce.number().int().min(200).max(20000),
});

// ---------------- Ders listesi, dönem dersleri, notlar ----------------

export const PlanAddSchema = z.object({
  courseCode,
  /** Koordinatör eklerken zorunlu (ilk kurulum ve şablon hariç). Öğrenci eklerken isteğe bağlı açıklama. */
  reason: optionalText(1000),
});

export const PlanFromTemplateSchema = z.object({ templateId: z.string().min(1), reason });

export const ExemptSchema = z.object({ reason, conditionNo: z.coerce.number().int().min(1).optional(), documentId: z.string().optional() });

export const AttemptCreateSchema = z.object({
  planItemId: z.string().min(1),
  termId,
  /** Seçmeli ders yeri için hangi dersin alındığı (katalogdan). */
  courseCode: courseCode.optional(),
});

/** Koordinatörün geriye dönük girişi: dönem ve notla birlikte doğrudan onaylı yazılır. */
export const BackfillSchema = z.object({
  planItemId: z.string().min(1),
  termId,
  courseCode: courseCode.optional(),
  grade: z.enum(GRADES).optional(),
  passed: z.boolean().optional(),
  note: optionalText(500),
});

export const AttemptCorrectSchema = z.object({
  termId: termId.optional(),
  grade: z.enum(GRADES).nullable().optional(),
  passed: z.boolean().optional(),
  reason,
});

export const GradeSubmissionSchema = z.object({
  termId,
  transcriptId: z.string().min(1, 'Bu dönemin ÇAP / YDP not belgesini seçin'),
  grades: z.array(z.object({ attemptId: z.string().min(1), grade: z.enum(GRADES) })).min(1, 'En az bir dersin notunu girin'),
});

export const ReviewSchema = z
  .object({
    decision: z.enum(['APPROVED', 'REJECTED']),
    note: optionalText(1000),
    /** Not onayında şartlı geçer (DC) sayılan denemeler */
    conditionalPass: z.array(z.string()).default([]),
  })
  .refine((v) => v.decision === 'APPROVED' || (v.note?.length ?? 0) >= 5, { message: 'Ret için en az 5 karakterlik gerekçe yazın', path: ['note'] });

// ---------------- Belgeler, mesajlar, notlar ----------------

export const DocumentMetaSchema = z.object({
  kind: z.enum(DOCUMENT_KINDS),
  termId: termId.optional(),
  /** Yeni sürümü yüklenen (reddedilen ya da yenilenen) belge */
  replacesId: z.string().optional(),
  /** Koordinatörün isteğine yanıt */
  requestId: z.string().optional(),
  note: optionalText(500),
});

export const DocumentRequestSchema = z.object({
  kind: z.enum(DOCUMENT_KINDS),
  termId: termId.optional(),
  message: z.string().trim().min(5).max(1000),
  dueDate: z.coerce.date().optional(),
});

export const MessageSchema = z.object({ body: z.string().trim().min(1, 'Mesaj boş olamaz').max(20000) });

export const NoteSchema = z.object({ body: z.string().trim().min(2).max(4000) });

export const GanoSchema = z.object({
  termId,
  gano: z.coerce.number().min(0).max(4),
  source: z.enum(GANO_SOURCES),
  sourceNote: optionalText(300),
  mainFrozen: z.boolean().default(false),
  mainGraduated: z.boolean().default(false),
});

export const LeaveSchema = z.object({ termId, reason: z.enum(LEAVE_REASONS), note: optionalText(1000) });

export const DecisionSchema = z.object({
  type: z.enum(DECISION_TYPES),
  reason,
  reference: optionalText(100),
  ruleCheckId: z.string().optional(),
});

// ---------------- Ders listesi şablonları ----------------

export const TemplateSaveSchema = z.object({
  type: z.enum(TRACK_TYPES),
  sourceProgramId: z.string().min(1).nullable(),
  title: z.string().trim().min(3).max(160),
  commonEcts: z.coerce.number().int().min(0).max(240),
  items: z
    .array(
      z.object({
        kind: z.enum(PLAN_ITEM_KINDS),
        code: z.string().trim().max(20).nullable().optional(),
        name: z.string().trim().min(2).max(160),
        ects: z.coerce.number().int().min(1).max(40),
        semester: z.coerce.number().int().min(1).max(8),
      }),
    )
    .min(1, 'En az bir ders ekleyin'),
  conditions: z
    .array(
      z.object({
        no: z.coerce.number().int().min(1),
        sourceCourseCode: z.string().trim().min(1).max(20),
        sourceCourseName: z.string().trim().min(2).max(160),
        targetCourseCode: z.string().trim().min(1).max(20),
        note: z.string().trim().max(300).nullable().optional(),
      }),
    )
    .default([]),
});
export type TemplateSaveInput = z.infer<typeof TemplateSaveSchema>;

// ---------------- Kurallar ve içe aktarma ----------------

export const RuleSetCreateSchema = z.object({
  type: z.enum(TRACK_TYPES),
  version: z.string().trim().min(3).max(40),
  effectiveFrom: z.coerce.date(),
  paramOverrides: z.record(z.string(), z.record(z.string(), z.unknown())).default({}),
  note: z.string().trim().max(1000).optional(),
});

export const ImportSchema = z.object({
  kind: z.enum(IMPORT_KINDS),
  commit: z.boolean().default(false),
  rows: z.array(z.record(z.string(), z.string())).min(1).max(2000),
});

export const ImportRowSchemas = {
  COURSES: CourseSchema,
  STUDENTS: StudentCreateSchema.omit({ sendInvite: true, commonEcts: true }).extend({ commonEcts: z.coerce.number().int().min(0).max(240).optional() }),
  ATTEMPTS: z.object({ studentNo, courseCode, termId, grade: z.enum(GRADES).optional().or(z.literal('').transform(() => undefined)) }),
};

export const SIGNERS_NOTE =
  'Formlar öğrencinin ana dalında ıslak imzayla hazırlanır; öğrenci taratıp yükler, koordinatör onaylar (sistemde imza akışı yoktur).';
