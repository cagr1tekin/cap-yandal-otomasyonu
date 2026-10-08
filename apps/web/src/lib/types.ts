import type {
  AttemptResult,
  CourseKind,
  CourseState,
  DecisionType,
  DocumentKind,
  GanoSource,
  LeaveReason,
  PlanItemKind,
  RecordSource,
  RequestStatus,
  ReviewStatus,
  Role,
  StudentStatus,
  TrackType,
} from '@cap/contracts';
import type { RuleResult } from '@cap/rules';

export interface Term {
  id: string;
  year: string;
  season: 'GUZ' | 'BAHAR';
  startsAt: string;
  endsAt: string;
  isCurrent: boolean;
}

export interface Program {
  id: string;
  name: string;
  faculty: string;
  isHome: boolean;
}

export interface Course {
  code: string;
  name: string;
  ects: number;
  credit: number | null;
  semester: number;
  kind: CourseKind;
  active: boolean;
  updatedBy: string | null;
  updatedAt: string;
}

export interface Me {
  id: string;
  username: string;
  displayName: string;
  email: string;
  role: Role;
  studentNo: string | null;
  currentTerm: Term | null;
}

export interface ExternalLink {
  key: string;
  label: string;
  system: string;
  url: string;
  description: string;
}

export interface Task {
  key: string;
  title: string;
  detail: string;
  count: number;
  link: string;
}

export interface Totals {
  plannedCount: number;
  plannedEcts: number;
  completedCount: number;
  completedEcts: number;
  exemptCount: number;
  remainingCount: number;
  remainingEcts: number;
  pendingItems: number;
}

export interface StudentRow {
  studentNo: string;
  fullName: string;
  track: TrackType;
  status: StudentStatus;
  admissionTerm: Term;
  mainProgram: string | null;
  account: { invitedAt: string | null; lastLoginAt: string | null; active: boolean } | null;
  totals: Totals;
  pending: number;
  unread: number;
  worst: 'OK' | 'WARN' | 'FAIL' | null;
  graduationReady: boolean;
}

export interface Attempt {
  id: string;
  termId: string;
  term: Term;
  courseCode: string;
  courseName: string;
  ects: number;
  status: ReviewStatus;
  source: RecordSource;
  result: AttemptResult;
  grade: string | null;
  createdBy: string;
  createdAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  correctedAt: string | null;
  correctedBy: string | null;
}

export interface PlanItem {
  id: string;
  kind: PlanItemKind;
  courseCode: string | null;
  name: string;
  ects: number;
  semester: number;
  status: ReviewStatus;
  source: RecordSource;
  addReason: string | null;
  createdBy: string;
  createdAt: string;
  reviewNote: string | null;
  removedAt: string | null;
  removedBy: string | null;
  removeReason: string | null;
  exemptAt: string | null;
  exemptReason: string | null;
  exemptCondNo: number | null;
  attempts: Attempt[];
  state: CourseState;
}

export interface GradeSubmission {
  id: string;
  termId: string;
  term: Term;
  status: ReviewStatus;
  submittedBy: string;
  submittedAt: string;
  reviewedBy: string | null;
  reviewNote: string | null;
  transcript: { id: string; fileName: string; status: ReviewStatus };
  items: { id: string; attemptId: string; grade: string; passed: boolean | null; attempt: { courseCode: string; courseName: string; ects: number } }[];
}

export interface CheckOutcome {
  version: string;
  inputs: Record<string, unknown>;
  termEnd: RuleResult[];
  plan: RuleResult[];
  graduation: RuleResult[];
  worst: 'OK' | 'WARN' | 'FAIL';
  graduationReady: boolean;
}

export interface StoredCheck {
  id: string;
  trigger: string;
  worst: 'OK' | 'WARN' | 'FAIL';
  createdBy: string;
  createdAt: string;
  ruleSet: { version: string };
  results: { termEnd: RuleResult[]; plan: RuleResult[]; graduation: RuleResult[]; graduationReady: boolean };
}

export interface Decision {
  id: string;
  type: DecisionType;
  reason: string;
  reference: string | null;
  ruleCheckId: string | null;
  previousStatus: StudentStatus;
  newStatus: StudentStatus;
  decidedBy: string;
  decidedAt: string;
  cancelledAt: string | null;
  cancelReason: string | null;
}

export interface StudentCard {
  student: {
    studentNo: string;
    fullName: string;
    schoolEmail: string;
    phone: string | null;
    track: TrackType;
    status: StudentStatus;
    source: RecordSource;
    commonEcts: number;
    admissionTermId: string;
    admissionTerm: Term;
    mainProgramId: string | null;
    mainProgram: Program | null;
    createdBy: string;
    createdAt: string;
    user?: { id: string; username: string; invitedAt: string | null; lastLoginAt: string | null; active: boolean } | null;
    ganoRecords: { id: string; termId: string; term: Term; gano: number; source: GanoSource; sourceNote: string | null; mainFrozen: boolean; mainGraduated: boolean; enteredBy: string | null; createdAt: string; cancelledAt: string | null; cancelReason: string | null }[];
    leaves: { id: string; term: Term; reason: LeaveReason; note: string | null; cancelledAt: string | null; cancelReason: string | null }[];
    decisions: Decision[];
    courseRequests: { id: string; code: string | null; name: string; note: string; status: ReviewStatus; createdAt: string; reviewNote: string | null; courseCode: string | null }[];
  };
  planItems: PlanItem[];
  totals: Totals;
  gradeSubmissions: GradeSubmission[];
  gradeable: (Attempt & { term: Term })[];
  live: CheckOutcome;
  checks: StoredCheck[];
  currentTerm: Term | null;
  terms: Term[];
  templates: { id: string; title: string; sourceProgramId: string | null; conditions: { no: number; sourceCourseCode: string; sourceCourseName: string; targetCourseCode: string }[] }[];
  can: { coordinator: boolean; editPlan: boolean; addAttempt: boolean; submitGrades: boolean; upload: boolean; message: boolean; requestCourse: boolean };
}

export interface DocumentRow {
  id: string;
  kind: DocumentKind;
  termId: string | null;
  term: Term | null;
  fileName: string;
  mimeType: string;
  size: number;
  sha256: string;
  note: string | null;
  status: ReviewStatus;
  uploadedBy: string;
  uploadedAt: string;
  reviewedBy: string | null;
  reviewNote: string | null;
  previousId: string | null;
  requestId: string | null;
  messageId: string | null;
  request: { id: string; message: string } | null;
}

export interface DocumentRequestRow {
  id: string;
  kind: DocumentKind;
  termId: string | null;
  message: string;
  dueDate: string | null;
  status: RequestStatus;
  createdBy: string;
  createdAt: string;
  closedAt: string | null;
  documents: { id: string; fileName: string; status: ReviewStatus; uploadedAt: string }[];
}

export interface MessageRow {
  id: string;
  body: string;
  createdAt: string;
  readAt: string | null;
  sender: { username: string; displayName: string; role: Role };
  attachments: { id: string; fileName: string; kind: DocumentKind; status: ReviewStatus }[];
}

export interface AuditRow {
  id: string;
  at: string;
  actor: string;
  actorRole: Role | null;
  action: string;
  entity: string;
  entityId: string;
  studentNo: string | null;
  before: unknown;
  after: unknown;
  reason: string | null;
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
  items: { id: string; position: number; kind: PlanItemKind; code: string | null; name: string; ects: number; semester: number }[];
  conditions: { id: string; no: number; sourceCourseCode: string; sourceCourseName: string; targetCourseCode: string; note: string | null }[];
  ects: number;
  totalEcts: number;
  results: RuleResult[];
  ok: boolean;
}

export interface UserRow {
  id: string;
  username: string;
  displayName: string;
  email: string;
  role: Role;
  active: boolean;
  invitedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  createdBy: string;
  student: { studentNo: string; track: TrackType; status: StudentStatus } | null;
}
