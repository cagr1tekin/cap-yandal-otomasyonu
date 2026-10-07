import type { ApplicationStatus, EnrollmentStatus, Proposal, Role, TrackType } from '@cap/contracts';
import type { RuleResult, Verdict } from '@cap/rules';

export interface Term {
  id: string;
  year: string;
  season: 'GUZ' | 'BAHAR';
  isCurrent: boolean;
}

export interface WindowState {
  open: boolean;
  phase: 'TANIMSIZ' | 'ONCE' | 'ACIK' | 'KAPANDI';
  opensAt: string | null;
  closesAt: string | null;
  announceAt?: string | null;
}

export interface EligibilityItem {
  offering: {
    id: string;
    type: TrackType;
    quota: number;
    programId: string;
    programName: string;
    unitName: string;
    coordinatorUsername: string;
    sourcePrograms: string[];
    poolEcts: number;
  };
  window: WindowState;
  verdict: Verdict;
  results: RuleResult[];
  application: { id: string; status: ApplicationStatus } | null;
}

export interface Eligibility {
  term: Term | null;
  student: {
    studentNo: string;
    fullName: string;
    programName: string;
    unitName: string;
    semesterNo: number;
    gano: number;
    classRankPercentile: number | null;
  } | null;
  items: EligibilityItem[];
}

export interface MyApplication {
  id: string;
  status: ApplicationStatus;
  path: 'RANK' | 'ENTRY_SCORE';
  submittedAt: string;
  withdrawnAt: string | null;
  offering: { id: string; type: TrackType; programName: string; unitName: string; term: string };
  result: { decisionNo: string; decisionDate: string; publishedAt: string; rank: number | null; proposal: Proposal | null } | null;
  eligibility: { verdict: Verdict; results: RuleResult[] };
}

export interface ExternalLink {
  key: string;
  label: string;
  system: string;
  url: string;
  description: string;
}

export interface PoolCourse {
  id: string;
  courseCode: string;
  name: string;
  ects: number;
}

export interface EnrollmentView {
  id: string;
  studentNo: string;
  fullName?: string;
  type: TrackType;
  status: EnrollmentStatus;
  statusLabel: string;
  ganoStrikes: number;
  startTerm: string;
  createdAt: string;
  program: { id: string; name: string; unitName: string };
  coordinatorUsername: string;
  pool: PoolCourse[];
  plan: { id: string; status: 'PROPOSED' | 'APPROVED'; approvedBy: string | null; course: PoolCourse }[];
  warnings: { id: string; ruleCode: string; status: 'WARN' | 'FAIL'; decision: string; result: RuleResult; at: string }[];
  withdrawals: { id: string; reason: string; createdAt: string; capToMinorOutcome: CapToMinor | null }[];
  progress?: {
    trackEcts: number;
    requiredEcts: number;
    trackGpa: number | null;
    mainGano: number;
    courses: { code: string; name: string; ects: number; grade: string; passed: boolean }[];
    graduation: RuleResult | null;
  } | null;
}

export interface CapToMinor {
  hasMinorProgram: boolean;
  passedPoolCourses?: string[];
  passedPoolEcts?: number;
  eligibleForCertificate?: boolean;
  eligibleForMinorEnrollment?: boolean;
  message?: string;
}

export interface Me {
  username: string;
  displayName: string;
  roles: Role[];
  studentNo: string | null;
  student: { programName: string; unitName: string; semesterNo: number; gano: number } | null;
  units: { id: string; name: string }[];
  programs: { id: string; name: string }[];
  coordinated: { id: string; type: TrackType; termId: string; program: { name: string }; term: Term }[];
  currentTerm: Term | null;
}

export interface Program {
  id: string;
  name: string;
  unitId: string;
  unit: { id: string; name: string };
}

export interface OfferingRow {
  id: string;
  type: TrackType;
  quota: number;
  status: 'DRAFT' | 'PUBLISHED' | 'CLOSED';
  coordinatorUsername: string;
  firstYearIntake: number | null;
  quotaJustification: string | null;
  rankingLockedAt: string | null;
  registrationClosedAt: string | null;
  termId: string;
  term: Term;
  program: Program & { category: string };
  sourcePrograms: { programId: string; program: { name: string } }[];
  poolCourses: PoolCourse[];
  _count?: { applications: number; enrollments: number };
}

export interface ReviewRow {
  id: string;
  studentNo: string;
  fullName: string;
  mainProgramName: string;
  gano: number;
  classRankPercentile: number | null;
  semesterNo: number;
  path: 'RANK' | 'ENTRY_SCORE';
  osymVerified: boolean;
  status: ApplicationStatus;
  submittedAt: string;
  ranking: { rank: number; score: number; proposal: Proposal; overriddenBy: string | null; overrideReason: string | null } | null;
}

export interface Decision {
  id: string;
  decisionDate: string;
  decisionNo: string;
  recordedBy: string;
  publishedAt: string | null;
}

export interface ReviewData {
  offering: OfferingRow;
  windowClosed: boolean;
  decision: Decision | null;
  strategy: string;
  rows: ReviewRow[];
}
