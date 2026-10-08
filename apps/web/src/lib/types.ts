import type {
  ApplicationStatus,
  ApprovalRole,
  DocumentDef,
  EnrollmentStatus,
  FindingDecision,
  FormStatus,
  LeaveReason,
  Proposal,
  Role,
  TrackType,
} from '@cap/contracts';
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

export interface Me {
  username: string;
  displayName: string;
  roles: Role[];
  assignments: { role: Role; unitId: string | null; programId: string | null }[];
  units: { id: string; name: string }[];
  programs: { id: string; name: string }[];
  coordinated: { id: string; type: TrackType; termId: string; program: { name: string }; term: Term }[];
  currentTerm: Term | null;
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

export interface Candidates {
  term: Term | null;
  student: {
    studentNo: string;
    fullName: string;
    email: string;
    programName: string;
    unitName: string;
    semesterNo: number;
    gano: number;
    classRankPercentile: number | null;
    entryScore: { year: number; score: number } | null;
  } | null;
  otherApplications: { id: string; status: ApplicationStatus; programName: string; type: TrackType }[];
  items: {
    offering: { id: string; type: TrackType; quota: number; programName: string; unitName: string; sourcePrograms: string[] };
    window: WindowState;
    verdict: Verdict;
    path: 'RANK' | 'ENTRY_SCORE';
    requiredDocuments: DocumentDef[];
    results: RuleResult[];
    application: { id: string; status: ApplicationStatus } | null;
  }[];
}

export interface ApplicationListRow {
  id: string;
  studentNo: string;
  fullName: string;
  status: ApplicationStatus;
  path: 'RANK' | 'ENTRY_SCORE';
  documentNo: string | null;
  documentDate: string | null;
  submittedAt: string;
  enteredBy: string | null;
  offering: { id: string; type: TrackType; programName: string; unitName: string };
}

export interface AuditRow {
  id: string;
  at: string;
  actor: string;
  action: string;
  entity: string;
  entityId: string;
  before: unknown;
  after: unknown;
  reason: string | null;
}

export interface ApplicationDetail {
  id: string;
  studentNo: string;
  status: ApplicationStatus;
  path: 'RANK' | 'ENTRY_SCORE';
  documentNo: string | null;
  documentDate: string | null;
  documents: string[] | null;
  enteredBy: string | null;
  note: string | null;
  withdrawReason: string | null;
  osymDocNo: string | null;
  osymVerified: boolean;
  submittedAt: string;
  obisSnapshot: { fullName: string; takenAt: string; ctx: { student: { gano: number; semesterNo: number; classRankPercentile: number | null; programId: string } } };
  eligibility: { verdict: Verdict; results: RuleResult[] };
  ruleSet: { version: string };
  ranking: { rank: number; proposal: Proposal; overriddenBy: string | null; overrideReason: string | null } | null;
  enrollment: { id: string } | null;
  offering: OfferingRow;
  requiredDocuments: DocumentDef[];
  audit: AuditRow[];
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

export interface Approval {
  id: string;
  round: number;
  role: ApprovalRole;
  assigneeUsername: string | null;
  decision: 'PENDING' | 'APPROVED' | 'REJECTED';
  decidedBy: string | null;
  decidedAt: string | null;
  comment: string | null;
}

export interface CourseItem {
  code: string;
  name: string;
  ects: number;
}

export interface EnrollmentListRow {
  id: string;
  studentNo: string;
  fullName?: string;
  type: TrackType;
  status: EnrollmentStatus;
  statusLabel: string;
  ganoStrikes: number;
  createdAt: string;
  program: { id: string; name: string; unitName: string };
  protocolStatus: FormStatus | null;
  currentRegistrationStatus: FormStatus | null;
  warnings: { id: string; ruleCode: string; status: 'WARN' | 'FAIL'; decision: FindingDecision; result: RuleResult; at: string }[];
}

export interface EnrollmentDetail {
  enrollment: {
    id: string;
    type: TrackType;
    status: EnrollmentStatus;
    statusLabel: string;
    ganoStrikes: number;
    startTermId: string;
    createdAt: string;
    registeredBy: string | null;
    registrationDocuments: string[] | null;
    trackAdvisorUsername: string | null;
    coordinatorUsername: string;
    program: { id: string; name: string; unitName: string };
  };
  student: { studentNo: string; fullName: string; email: string; advisorUsername: string; mainProgram?: string; mainUnit?: string };
  protocol: {
    id: string;
    status: FormStatus;
    round: number;
    commonEcts: number;
    createdBy: string;
    submittedAt: string | null;
    approvedAt: string | null;
    filedAt: string | null;
    filedBy: string | null;
    courses: CourseItem[];
    approvals: Approval[];
    results: RuleResult[];
  } | null;
  protocolOptions: {
    courses: (CourseItem & { semester: number | null; inMain: boolean })[];
    commonCourses: (CourseItem & { semester: number })[];
    commonEcts: number;
    poolEcts: number;
  };
  courseRegistrations: { id: string; termId: string; status: FormStatus; round: number; items: CourseItem[]; approvals: Approval[]; submittedAt: string | null; enteredAt: string | null }[];
  leaves: { id: string; termId: string; reason: LeaveReason; note: string | null; createdBy: string; createdAt: string }[];
  findings: { id: string; ruleCode: string; status: 'WARN' | 'FAIL'; decision: FindingDecision; result: RuleResult; reason: string | null; scan: { createdAt: string } }[];
  withdrawals: { id: string; reason: string; createdAt: string; capToMinorOutcome: CapToMinor | null }[];
  progress: {
    trackEcts: number;
    requiredEcts: number;
    trackGpa: number | null;
    mainGano: number;
    semesterNo: number;
    courses: { code: string; name: string; ects: number; grade: string; passed: boolean }[];
    graduation: RuleResult | null;
  } | null;
  currentTerm: Term | null;
  terms: Term[];
  window: { registrationDeadline: string | null; waitlistDeadline: string | null; courseRegistrationDeadline: string | null } | null;
  links: ExternalLink[];
  can: { editProtocol: boolean; fileProtocol: boolean; courseRegistration: boolean; withdraw: boolean; leave: boolean; setTrackAdvisor: boolean };
}

export interface CapToMinor {
  hasMinorProgram: boolean;
  passedPoolCourses?: string[];
  passedPoolEcts?: number;
  eligibleForCertificate?: boolean;
  eligibleForMinorEnrollment?: boolean;
  message?: string;
}

export interface MyApproval {
  id: string;
  role: ApprovalRole;
  roleLabel: string;
  createdAt: string;
  subject: { kind: 'PROTOCOL' | 'COURSE_REG'; label: string; enrollmentId: string; round: number; ects: number; courseCount: number; termId: string | null };
  enrollment: { id: string; studentNo: string; fullName: string; type: TrackType; programName: string };
}

export interface Task {
  key: string;
  role: Role | 'ONAY';
  title: string;
  detail: string;
  count: number;
  link: string;
}

export interface CourseRegRow {
  id: string;
  status: FormStatus;
  termId: string;
  enrollmentId: string;
  studentNo: string;
  fullName: string;
  type: TrackType;
  programName: string;
  unitName: string;
  submittedAt: string | null;
  enteredAt: string | null;
  items: CourseItem[];
}

export interface ProtocolRow {
  id: string;
  status: FormStatus;
  round: number;
  updatedAt: string;
  approvedAt: string | null;
  filedAt: string | null;
  ects: number;
  enrollmentId: string;
  studentNo: string;
  fullName: string;
  type: TrackType;
  programName: string;
  unitName: string;
}
