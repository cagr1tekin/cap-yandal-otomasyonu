import { CURRICULA, PROGRAMS, STUDENTS, type SeedStudent, type SeedTrack, studentEmail } from '@cap/seed-data';

/** Bellek içi, değiştirilebilir OBİS durumu. Senaryo uçlarıyla ve /_admin/reset ile yönetilir. */
class ObisStore {
  students = new Map<string, SeedStudent>();

  constructor() {
    this.reset();
  }

  reset() {
    this.students = new Map(STUDENTS.map((s) => [s.studentNo, structuredClone(s)]));
  }

  get(no: string): SeedStudent | undefined {
    return this.students.get(no);
  }

  student(no: string) {
    const s = this.get(no);
    if (!s) return undefined;
    return {
      studentNo: s.studentNo,
      fullName: s.fullName,
      email: studentEmail(s.studentNo),
      programId: s.programId,
      advisorUsername: s.advisorUsername,
    };
  }

  standing(no: string) {
    const s = this.get(no);
    if (!s) return undefined;
    return {
      studentNo: s.studentNo,
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

  track(no: string, programId: string) {
    const s = this.get(no);
    if (!s) return undefined;
    const t: SeedTrack = s.tracks.find((x) => x.programId === programId) ?? {
      programId,
      gpaByTerm: [],
      consecutiveTermsWithoutCourse: 0,
      results: [],
    };
    return {
      programId,
      gpaByTerm: t.gpaByTerm,
      consecutiveTermsWithoutCourse: t.consecutiveTermsWithoutCourse,
      results: t.results.map((r) => {
        const c = CURRICULA[programId]?.find((x) => x.code === r.code);
        return { ...r, name: c?.name ?? r.code, ects: c?.ects ?? 0 };
      }),
    };
  }

  baseScore(programId: string, year: number): number | null {
    return PROGRAMS.find((p) => p.id === programId)?.baseScores[year] ?? null;
  }

  verifyOsym(docNo: string, code: string) {
    for (const s of this.students.values()) {
      if (s.osymDocument?.docNo === docNo && s.osymDocument.verificationCode === code && s.entryScore) {
        return { valid: true, studentNo: s.studentNo, year: s.entryScore.year, score: s.entryScore.score };
      }
    }
    return { valid: false };
  }

  advisees(username: string): string[] {
    return [...this.students.values()].filter((s) => s.advisorUsername === username).map((s) => s.studentNo);
  }
}

export const store = new ObisStore();
