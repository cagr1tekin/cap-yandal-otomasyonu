import type { OfferingSnapshot, RuleDefinition, StudentSnapshot } from '../src';

export function student(over: Partial<StudentSnapshot> = {}): StudentSnapshot {
  return {
    studentNo: '230101001',
    programId: 'P-ISLETME',
    level: 'LISANS',
    durationYears: 4,
    semesterNo: 3,
    gano: 3.1,
    completedAllCoursesToDate: true,
    classRankPercentile: 10,
    entryScore: { year: 2025, score: 400 },
    yokRankRequirementMet: null,
    talentExamPassedProgramIds: [],
    frozen: false,
    ...over,
  };
}

export function offering(over: Partial<OfferingSnapshot> = {}): OfferingSnapshot {
  return {
    id: 'O-1',
    programId: 'P-IKTISAT',
    type: 'CAP',
    quota: 10,
    sourceProgramIds: [],
    requiresTalentExam: false,
    requiresSuccessRank: false,
    programBaseScore: 350,
    programCategory: 'DIGER',
    firstYearIntake: 40,
    ...over,
  };
}

export function rule(kind: string, params: Record<string, unknown> = {}): RuleDefinition {
  return { code: 'T-1', kind, article: 'Test m.1', title: 'Test', appliesTo: 'CAP', phase: 'APPLICATION', params };
}
