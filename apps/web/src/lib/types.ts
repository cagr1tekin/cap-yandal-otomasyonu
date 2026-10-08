import type {
  ApplicationStatus,
  ApprovalRole,
  ApprovalSubject,
  CourseKind,
  DocumentDef,
  DocumentKind,
  EnrollmentStatus,
  FindingDecision,
  FormStatus,
  LeaveReason,
  Proposal,
  ProtocolItemKind,
  ProtocolItemStatus,
  Role,
  StaffRole,
  TrackType,
  VerificationStatus,
} from '@cap/contracts';
import type { RuleResult, Verdict } from '@cap/rules';

export interface Term {
  id: string;
  year: string;
  season: 'GUZ' | 'BAHAR';
  isCurrent: boolean;
}

export interface Program {
  id: string;
  name: string;
  faculty: string;
  codePrefix: string | null;
  isHome: boolean;
}

export interface Course {
  code: string;
  name: string;
  ects: number;
  semester: number;
  kind: CourseKind;
}

export interface WindowState {
  open: boolean;
  phase: 'TASLAK' | 'ONCE' | 'ACIK' | 'KAPANDI';
  opensAt: string;
  closesAt: string;
  announceAt?: string | null;
}

export interface Me {
  username: string;
  displayName: string;
  email: string | null;
  roles: Role[];
  assignments: { role: StaffRole; programId: string | null }[];
  studentNo: string | null;
  programs: { id: string; name: string }[];
  home: Program;
  homeHead: boolean;
  mainDepartmentSigner: boolean;
  currentTerm: Term | null;
}

export interface ExternalLink {
  key: string;
  label: string;
  system: string;
  url: string;
  description: string;
}

export interface OfferingRow {
  id: string;
  type: TrackType;
  quota: number;
  status: 'DRAFT' | 'PUBLISHED' | 'CLOSED';
  firstYearIntake: number | null;
  quotaJustification: string | null;
  opensAt: string;
  closesAt: string;
  announceAt: string | null;
  registrationDeadline: string | null;
  waitlistDeadline: string | null;
  rankingLockedAt: string | null;
  registrationClosedAt: string | null;
  termId: string;
  term: Term;
  sourcePrograms: { programId: string; program: { name: string } }[];
  window: WindowState;
  _count?: { applications: number; enrollments: number };
}

export interface OfferingBrief {
  id: string;
  type: TrackType;
  quota: number;
  term: Term;
  sourcePrograms: string[];
  announceAt: string | null;
  registrationDeadline: string | null;
}

export interface StudentDocument {
  id: string;
  kind: DocumentKind;
  fileName: string;
  size: number;
  uploadedAt: string;
  _count?: { applications: number };
}

export interface StudentProfile {
  studentNo: string;
  fullName: string;
  email: string;
  phone: string | null;
  programId: string;
  program: Program;
  entryYear: number;
  semesterNo: number;
  gano: number;
  completedAllCourses: boolean;
  classRank: number | null;
  classSize: number | null;
  classRankPercentile: number | null;
  entryScore: number | null;
  successRank: number | null;
  advisorUsername: string | null;
  updatedAt: string;
  documents: StudentDocument[];
}

export interface ProfileData {
  account: { username: string; displayName: string; email: string | null };
  profile: StudentProfile | null;
  programs: Program[];
  advisors: { username: string; displayName: string; programId: string }[];
}

export interface EligibilityData {
  term: Term | null;
  hasProfile: boolean;
  items: {
    offering: OfferingBrief;
    window: WindowState;
    verdict: Verdict | null;
    path?: 'RANK' | 'ENTRY_SCORE';
    results: RuleResult[];
    requiredDocuments: DocumentDef[];
    missingDocuments: DocumentDef[];
    application: { id: string; status: ApplicationStatus } | null;
  }[];
}

export interface MyApplication {
  id: string;
  status: ApplicationStatus;
  verification: VerificationStatus;
  path: 'RANK' | 'ENTRY_SCORE';
  submittedAt: string;
  rank: number | null;
  enrollmentId: string | null;
  offering: OfferingBrief;
  registrationOpen: boolean;
}

export interface ApplicationListRow {
  id: string;
  studentNo: string;
  fullName: string;
  mainProgramName: string;
  gano: number;
  status: ApplicationStatus;
  verification: VerificationStatus;
  path: 'RANK' | 'ENTRY_SCORE';
  submittedAt: string;
  offering: { id: string; type: TrackType; term: Term };
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

export interface Declared {
  gano: number;
  semesterNo: number;
  completedAllCourses: boolean;
  classRank: number | null;
  classSize: number | null;
  entryYear: number;
  entryScore: number | null;
  successRank: number | null;
}

export interface ApplicationDetail {
  id: string;
  studentNo: string;
  status: ApplicationStatus;
  verification: VerificationStatus;
  verifiedBy: string | null;
  verifiedAt: string | null;
  verificationNote: string | null;
  path: 'RANK' | 'ENTRY_SCORE';
  withdrawReason: string | null;
  submittedAt: string;
  snapshot: { fullName: string; mainProgramName: string; takenAt: string; declared: Declared };
  eligibility: { verdict: Verdict; results: RuleResult[] };
  ruleSet: { version: string };
  ranking: { rank: number; proposal: Proposal; overriddenBy: string | null; overrideReason: string | null } | null;
  enrollment: { id: string } | null;
  offering: Omit<OfferingRow, 'window'>;
  student: { studentNo: string; fullName: string; email: string; phone: string | null; program: Program; advisorUsername: string | null };
  documents: StudentDocument[];
  requiredDocuments: DocumentDef[];
  sameFaculty: boolean;
  window: WindowState;
  decisionPublished: boolean;
  audit: AuditRow[];
  can: { verify: boolean; withdraw: boolean; accept: boolean };
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
  verification: VerificationStatus;
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
  offering: Omit<OfferingRow, 'window'>;
  window: WindowState;
  windowClosed: boolean;
  decision: Decision | null;
  unverified: number;
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

export interface TemplateItem {
  id: string;
  position: number;
  kind: ProtocolItemKind;
  code: string | null;
  name: string;
  ects: number;
  semester: number;
}

export interface Condition {
  id: string;
  no: number;
  sourceCourseCode: string;
  sourceCourseName: string;
  targetCourseCode: string;
  note: string | null;
}

export interface Template {
  id: string;
  type: TrackType;
  sourceProgramId: string | null;
  sourceProgram: Program | null;
  title: string;
  commonEcts: number;
  source: string | null;
  updatedBy: string | null;
  updatedAt: string;
  items: TemplateItem[];
  conditions: Condition[];
  ects: number;
  totalEcts: number;
  results: RuleResult[];
  ok: boolean;
  _count?: { protocols: number };
}

export interface ProtocolCourse {
  id: string;
  position: number;
  kind: ProtocolItemKind;
  code: string | null;
  name: string;
  ects: number;
  semester: number;
  status: ProtocolItemStatus;
  grade: string | null;
  fulfilledCode: string | null;
  fulfilledName: string | null;
  termId: string | null;
}

export interface RegistrationOption {
  protocolCourseId: string;
  kind: ProtocolItemKind;
  code: string | null;
  name: string;
  ects: number;
  semester: number;
  status: ProtocolItemStatus;
  choices: { code: string; name: string; ects: number }[];
}

export interface CourseRegistration {
  id: string;
  termId: string;
  term: Term;
  status: FormStatus;
  round: number;
  submittedAt: string | null;
  approvedAt: string | null;
  items: { id: string; protocolCourseId: string; code: string; name: string; ects: number; protocolCourse: { status: ProtocolItemStatus; grade: string | null; kind: ProtocolItemKind; name: string } }[];
  approvals: Approval[];
}

export interface ExemptionOption extends Condition {
  targetCourseName: string;
  targetLabel: string | null;
  targetProtocolCourseId: string | null;
  request: { id: string; status: FormStatus; round: number; sourceGrade: string; sourceTerm: string; createdAt: string; approvedAt: string | null } | null;
  available: boolean;
  approvals: Approval[];
}

export interface CapToMinor {
  hasMinorProgram: boolean;
  passedPoolCourses?: string[];
  passedPoolEcts?: number;
  eligibleForCertificate?: boolean;
  message?: string;
}

export interface EnrollmentListRow {
  id: string;
  studentNo: string;
  fullName: string;
  mainProgramName: string;
  type: TrackType;
  status: EnrollmentStatus;
  statusLabel: string;
  ganoStrikes: number;
  createdAt: string;
  term: Term;
  protocolStatus: FormStatus | null;
  currentRegistrationStatus: FormStatus | null;
  trackEcts: number;
  requiredEcts: number;
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
    completedAt: string | null;
    mainAdvisorUsername: string | null;
    mainGraduationGano: number | null;
    program: { id: string; name: string; faculty: string };
    offering: { id: string; term: Term };
  };
  student: { studentNo: string; fullName: string; email: string; mainProgram: string; mainFaculty: string; mainProgramId: string };
  protocol: {
    id: string;
    status: FormStatus;
    round: number;
    commonEcts: number;
    createdBy: string;
    submittedAt: string | null;
    approvedAt: string | null;
    template: { title: string; source: string | null };
    courses: ProtocolCourse[];
    approvals: Approval[];
    results: RuleResult[];
  } | null;
  template: { id: string; title: string; commonEcts: number; items: TemplateItem[]; ects: number } | null;
  courseRegistrations: CourseRegistration[];
  registrationOptions: RegistrationOption[];
  exemptions: ExemptionOption[];
  termRecords: { id: string; termId: string; term: Term; mainGano: number; mainFrozen: boolean; declaredBy: string; declaredAt: string; verifiedBy: string | null; verifiedAt: string | null }[];
  leaves: { id: string; termId: string; term: Term; reason: LeaveReason; note: string | null; createdBy: string; createdAt: string }[];
  findings: { id: string; ruleCode: string; status: 'WARN' | 'FAIL'; decision: FindingDecision; result: RuleResult; reason: string | null; scan: { createdAt: string; term: Term } }[];
  withdrawals: { id: string; reason: string; requestedBy: string; createdAt: string; capToMinorOutcome: CapToMinor | null }[];
  progress: { trackEcts: number; requiredEcts: number; trackGpa: number | null; mainGano: number; graduation: RuleResult | null } | null;
  currentTerm: Term | null;
  terms: (Term & { startsAt: string; endsAt: string })[];
  advisors: { username: string; displayName: string }[];
  links: ExternalLink[];
  viewer: { owner: boolean; coordinator: boolean };
  can: {
    createProtocol: boolean;
    submitProtocol: boolean;
    courseRegistration: boolean;
    exemption: boolean;
    grades: boolean;
    termRecord: boolean;
    verifyTermRecord: boolean;
    withdraw: boolean;
    leave: boolean;
    setAdvisor: boolean;
    complete: boolean;
  };
}

export interface MyApproval {
  id: string;
  role: ApprovalRole;
  roleLabel: string;
  proxy: boolean;
  createdAt: string;
  subject: { id: string; kind: ApprovalSubject; label: string; enrollmentId: string; round: number; summary: string };
  enrollment: { id: string; studentNo: string; fullName: string; type: TrackType; mainProgramName: string };
}

export interface Task {
  key: string;
  role: Role | 'IMZA';
  title: string;
  detail: string;
  count: number;
  link: string;
}

export interface YearStat {
  year: number;
  baseScore: number;
  successRankLimit: number | null;
  updatedBy: string | null;
}
