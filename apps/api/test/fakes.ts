import { CURRICULA, PROGRAMS, STUDENTS, USERS, studentEmail, type SeedStudent } from '@cap/seed-data';
import type { JWTPayload } from 'jose';
import { TokenVerifier } from '../src/auth/auth';
import {
  ObisPort,
  OsymPort,
  type ObisStanding,
  type ObisTrack,
  type OsymVerification,
} from '../src/integrations/obis.port';

/** Testte belirteç = kullanıcı adı. Yetki veritabanındaki rol atamalarından gelir. */
export class FakeTokenVerifier extends TokenVerifier {
  async verify(token: string): Promise<JWTPayload> {
    const u = USERS.find((x) => x.username === token) ?? (token.startsWith('yeni.') ? { username: token, displayName: token, email: `${token}@personel.test`, assignments: [] } : null);
    if (!u) throw new Error('bilinmeyen kullanıcı');
    return {
      sub: `sub-${u.username}`,
      preferred_username: u.username,
      name: u.displayName,
      email: u.email,
      realm_access: { roles: [...new Set(u.assignments.map((a) => a.role))] },
    } as JWTPayload;
  }
}

/** Bellek içi OBİS (apps/mock-obis ile aynı veri). */
export class FakeObis extends ObisPort {
  students = new Map<string, SeedStudent>(STUDENTS.map((s) => [s.studentNo, structuredClone(s)]));

  private s(no: string) {
    const s = this.students.get(no);
    if (!s) throw new Error(`öğrenci yok: ${no}`);
    return s;
  }

  async getStudent(no: string) {
    const s = this.s(no);
    return { studentNo: no, fullName: s.fullName, email: studentEmail(no), programId: s.programId, advisorUsername: s.advisorUsername };
  }

  async getStanding(no: string): Promise<ObisStanding> {
    const s = this.s(no);
    return {
      studentNo: no,
      programId: s.programId,
      semesterNo: s.semesterNo,
      gano: s.gano,
      completedAllCoursesToDate: s.completedAllCoursesToDate,
      classRankPercentile: s.classRankPercentile,
      entryScore: s.entryScore,
      yokRankRequirementMet: s.yokRankRequirementMet,
      talentExamPassedProgramIds: s.talentExamPassedProgramIds,
      frozen: s.frozen,
      mainGraduated: false,
    };
  }

  async getTrack(no: string, programId: string): Promise<ObisTrack> {
    const t = this.s(no).tracks.find((x) => x.programId === programId);
    return {
      programId,
      gpaByTerm: t?.gpaByTerm ?? [],
      consecutiveTermsWithoutCourse: t?.consecutiveTermsWithoutCourse ?? 0,
      results: (t?.results ?? []).map((r) => {
        const c = CURRICULA[programId]?.find((x) => x.code === r.code);
        return { ...r, name: c?.name ?? r.code, ects: c?.ects ?? 0 };
      }),
    };
  }

  async getProgramBaseScore(programId: string, year: number) {
    return PROGRAMS.find((p) => p.id === programId)?.baseScores[year] ?? null;
  }

  async getAdvisees(username: string) {
    return [...this.students.values()].filter((s) => s.advisorUsername === username).map((s) => s.studentNo);
  }

  async ping() {
    return true;
  }
}

export class FakeOsym extends OsymPort {
  async verifyResultDocument(docNo: string, code: string): Promise<OsymVerification> {
    const s = STUDENTS.find((x) => x.osymDocument?.docNo === docNo && x.osymDocument.verificationCode === code);
    return s?.entryScore ? { valid: true, studentNo: s.studentNo, year: s.entryScore.year, score: s.entryScore.score } : { valid: false };
  }
}
