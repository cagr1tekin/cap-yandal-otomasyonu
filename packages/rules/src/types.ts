export type TrackType = 'CAP' | 'YANDAL';
export type ProgramLevel = 'ONLISANS' | 'LISANS';
export type ProgramCategory = 'MUHENDISLIK' | 'HUKUK' | 'TIP' | 'SAGLIK' | 'DIGER';
export type RulePhase = 'APPLICATION' | 'TERM_END' | 'GRADUATION' | 'CONFIGURATION' | 'PROTOCOL';

/** PASS: sağlandı, FAIL: sağlanmadı, WARN: uyarı (engellemez), CONDITIONAL: ek bilgi/doğrulama gerekiyor. */
export type RuleStatus = 'PASS' | 'FAIL' | 'WARN' | 'CONDITIONAL' | 'NOT_APPLICABLE';

export type Verdict = 'ELIGIBLE' | 'CONDITIONAL' | 'INELIGIBLE';

export interface RuleDefinition {
  code: string;
  kind: string;
  article: string;
  title: string;
  appliesTo: TrackType;
  phase: RulePhase;
  params: Record<string, unknown>;
}

export interface RuleSetDefinition {
  version: string;
  type: TrackType;
  effectiveFrom: string;
  rules: RuleDefinition[];
}

export interface RuleEffects {
  /** KR-ÇAP-11: onaylanınca öğrencinin GNO düşüş sayacı artırılır. */
  incrementGanoStrikes?: boolean;
  /** KR-ÇAP-12: kayıt dondurulmuş sayılır. */
  freezeEnrollment?: boolean;
}

export interface RuleResult {
  code: string;
  kind: string;
  article: string;
  title: string;
  status: RuleStatus;
  message: string;
  actual?: string | number | null;
  expected?: string | number | null;
  effects?: RuleEffects;
  children?: RuleResult[];
}

/** OBİS'ten okunan öğrenci verisinin kural için gereken kısmı. */
export interface StudentSnapshot {
  studentNo: string;
  programId: string;
  level: ProgramLevel;
  durationYears: number;
  /** Başvurulan dönemde öğrencinin başlayacağı yarıyıl (ör. 3 = 3. yarıyılın başı). */
  semesterNo: number;
  gano: number;
  completedAllCoursesToDate: boolean;
  /** Sınıfındaki başarı yüzdeliği; 12.5 = en üst %12.5. Bilinmiyorsa null. */
  classRankPercentile: number | null;
  entryScore: { year: number; score: number } | null;
  /** Kayıt yılındaki YÖK başarı sıralaması şartını sağlıyor mu; şart yoksa null. */
  yokRankRequirementMet: boolean | null;
  talentExamPassedProgramIds: string[];
  frozen: boolean;
}

export interface OfferingSnapshot {
  id: string;
  programId: string;
  type: TrackType;
  quota: number;
  /** Boşsa tüm programlardan öğrenci kabul edilir. */
  sourceProgramIds: string[];
  requiresTalentExam: boolean;
  requiresSuccessRank: boolean;
  programBaseScore: number | null;
  programCategory: ProgramCategory;
  firstYearIntake: number | null;
}

export interface EnrollmentRef {
  offeringId: string;
  programId: string;
  type: TrackType;
  status: 'ACTIVE' | 'FROZEN' | 'WITHDRAWN' | 'REMOVED' | 'COMPLETED';
}

export interface TrackHistory {
  /** Kayıt dönemi sonundaki ana dal GNO'su. */
  mainGano: number;
  /** Çift ana dal / yan dal ortalamaları, eskiden yeniye. */
  trackGpaByTerm: number[];
  consecutiveTermsWithoutCourse: number;
  ganoStrikes: number;
  /** Bu dönem için kayıtlı dönem izni (Erasmus/Farabi, dersin açılmaması vb.) var mı. */
  onLeave?: boolean;
}

export interface MinorPlanInfo {
  poolEcts: number;
  planEcts: number;
  planCourseCount: number;
}

/** Kabul ve Ders Protokolü (Esaslar m.3, Yönerge m.7/2). */
export interface ProtocolInfo {
  level: ProgramLevel;
  durationYears: number;
  /** Protokoldeki derslerin AKTS toplamı. */
  courseEcts: number;
  courseCount: number;
  /** Ana dalda alınan ve iki programda ortak sayılan derslerin AKTS toplamı. */
  commonEcts: number;
  /** Ana dal müfredatında da bulunan, protokole yazılmış ders kodları. */
  overlapCodes: string[];
}

export interface GraduationInfo {
  mainGraduated: boolean;
  mainGano: number;
  trackCompleted: boolean;
  trackEcts: number;
  requiredEcts: number;
  trackGpa: number | null;
}

export interface EvaluationContext {
  student?: StudentSnapshot;
  offering?: OfferingSnapshot;
  enrollments?: EnrollmentRef[];
  previouslyRemovedProgramIds?: string[];
  /** ÖSYM sonuç belgesi doğrulandı mı (YKS yolu). */
  osymVerified?: boolean;
  history?: TrackHistory;
  minorPlan?: MinorPlanInfo;
  protocol?: ProtocolInfo;
  graduation?: GraduationInfo;
}

export type Evaluator = (rule: RuleDefinition, ctx: EvaluationContext) => RuleResult;

export interface EvaluationOutcome {
  verdict: Verdict;
  results: RuleResult[];
}
