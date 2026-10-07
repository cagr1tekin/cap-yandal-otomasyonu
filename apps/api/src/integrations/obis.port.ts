/** OBİS'e erişim arayüzü (teknik doküman 4.3). Gerçek OBİS yalnızca bu arayüzün yeni bir uygulamasıyla bağlanır. */

export interface ObisStudent {
  studentNo: string;
  fullName: string;
  email: string;
  programId: string;
  advisorUsername: string;
}

export interface ObisStanding {
  studentNo: string;
  programId: string;
  semesterNo: number;
  gano: number;
  completedAllCoursesToDate: boolean;
  classRankPercentile: number | null;
  entryScore: { year: number; score: number } | null;
  yokRankRequirementMet: boolean | null;
  talentExamPassedProgramIds: string[];
  frozen: boolean;
  mainGraduated: boolean;
}

export interface ObisCourseResult {
  code: string;
  name: string;
  ects: number;
  grade: string;
  passed: boolean;
}

export interface ObisTrack {
  programId: string;
  gpaByTerm: number[];
  consecutiveTermsWithoutCourse: number;
  results: ObisCourseResult[];
}

export interface OsymVerification {
  valid: boolean;
  studentNo?: string;
  year?: number;
  score?: number;
}

export abstract class ObisPort {
  abstract getStudent(studentNo: string): Promise<ObisStudent>;
  abstract getStanding(studentNo: string, opts?: { fresh?: boolean }): Promise<ObisStanding>;
  abstract getTrack(studentNo: string, programId: string): Promise<ObisTrack>;
  abstract getProgramBaseScore(programId: string, year: number): Promise<number | null>;
  abstract isRegistered(studentNo: string, programId: string): Promise<boolean>;
  abstract getAdvisees(advisorUsername: string): Promise<string[]>;
  abstract ping(): Promise<boolean>;
}

export abstract class OsymPort {
  abstract verifyResultDocument(docNo: string, verificationCode: string): Promise<OsymVerification>;
}
