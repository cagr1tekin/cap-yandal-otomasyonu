import { describe, expect, it } from 'vitest';
import { evaluateRule, fmt } from '../src';
import type { EnrollmentRef, TrackHistory } from '../src';
import { offering, rule, student } from './helpers';

const history = (over: Partial<TrackHistory> = {}): TrackHistory => ({
  mainGano: 3,
  trackGpaByTerm: [3],
  consecutiveTermsWithoutCourse: 0,
  ganoStrikes: 0,
  ...over,
});

const enr = (over: Partial<EnrollmentRef> = {}): EnrollmentRef => ({
  offeringId: 'O-9',
  programId: 'P-X',
  type: 'CAP',
  status: 'ACTIVE',
  ...over,
});

describe('fmt', () => {
  it('virgüllü iki hane', () => expect(fmt(2.7)).toBe('2,70'));
});

describe('bilinmeyen tür ve eksik parametre', () => {
  it('bilinmeyen tür hata verir', () => {
    expect(() => evaluateRule(rule('YOK'), {})).toThrow('Bilinmeyen kural türü');
  });
  it('sayı olmayan parametre hata verir', () => {
    expect(() => evaluateRule(rule('MIN_GANO', { min: '2.75' }), { student: student() })).toThrow('sayı olmalı');
  });
});

describe('bağlam yoksa NOT_APPLICABLE', () => {
  const kinds = [
    'ALL_COURSES_PASSED', 'MIN_GANO', 'CLASS_RANK_TOP', 'ENTRY_SCORE_GTE_BASE', 'SUCCESS_RANK_REQUIREMENT',
    'SEMESTER_WINDOW', 'MAX_ACTIVE_TRACKS', 'NOT_SAME_PROGRAM_BOTH', 'NOT_OWN_PROGRAM', 'TALENT_EXAM_PASSED',
    'SOURCE_PROGRAM_ALLOWED', 'MIN_QUOTA_RATIO', 'CONSECUTIVE_TERMS_NO_COURSE', 'GANO_DROP_STRIKES',
    'MAIN_GANO_BELOW', 'TRACK_GPA_CONSECUTIVE_BELOW', 'NOT_PREVIOUSLY_REMOVED', 'MINOR_PLAN_LIMITS',
    'GRADUATION_CAP', 'GRADUATION_MINOR', 'FROZEN_WITH_MAIN',
  ];
  it.each(kinds)('%s', (kind) => {
    expect(evaluateRule(rule(kind, { min: 1 }), {}).status).toBe('NOT_APPLICABLE');
  });
});

describe('ALL_COURSES_PASSED', () => {
  it.each([
    [true, 'PASS'],
    [false, 'FAIL'],
  ])('%s → %s', (v, s) => {
    expect(evaluateRule(rule('ALL_COURSES_PASSED'), { student: student({ completedAllCoursesToDate: v }) }).status).toBe(s);
  });
});

describe('MIN_GANO (ÇAP 2.75 sınırı)', () => {
  it.each([
    [2.74, 'FAIL'],
    [2.75, 'PASS'],
    [2.76, 'PASS'],
  ])('GNO %s → %s', (gano, s) => {
    const r = evaluateRule(rule('MIN_GANO', { min: 2.75 }), { student: student({ gano }) });
    expect(r.status).toBe(s);
    expect(r.expected).toBe(2.75);
  });
});

describe('CLASS_RANK_TOP', () => {
  it.each([
    [20, 'PASS'],
    [20.01, 'FAIL'],
    [null, 'FAIL'],
  ])('yüzdelik %s → %s', (p, s) => {
    expect(evaluateRule(rule('CLASS_RANK_TOP', { percent: 20 }), { student: student({ classRankPercentile: p }) }).status).toBe(s);
  });
});

describe('ENTRY_SCORE_GTE_BASE', () => {
  const r = rule('ENTRY_SCORE_GTE_BASE');
  it('taban puan yok → FAIL', () => {
    expect(evaluateRule(r, { student: student(), offering: offering({ programBaseScore: null }) }).status).toBe('FAIL');
  });
  it('giriş puanı yok → FAIL', () => {
    expect(evaluateRule(r, { student: student({ entryScore: null }), offering: offering() }).status).toBe('FAIL');
  });
  it('puan < taban → FAIL', () => {
    expect(evaluateRule(r, { student: student({ entryScore: { year: 2025, score: 349.99 } }), offering: offering() }).status).toBe('FAIL');
  });
  it('puan = taban, doğrulanmamış → CONDITIONAL', () => {
    expect(evaluateRule(r, { student: student({ entryScore: { year: 2025, score: 350 } }), offering: offering() }).status).toBe('CONDITIONAL');
  });
  it('puan ≥ taban, doğrulanmış → PASS', () => {
    expect(evaluateRule(r, { student: student(), offering: offering(), osymVerified: true }).status).toBe('PASS');
  });
});

describe('SUCCESS_RANK_REQUIREMENT', () => {
  const r = rule('SUCCESS_RANK_REQUIREMENT');
  it('şart yok → NA', () => {
    expect(evaluateRule(r, { student: student(), offering: offering() }).status).toBe('NOT_APPLICABLE');
  });
  it.each([
    [true, 'PASS'],
    [false, 'FAIL'],
    [null, 'FAIL'],
  ])('%s → %s', (v, s) => {
    expect(
      evaluateRule(r, { student: student({ yokRankRequirementMet: v }), offering: offering({ requiresSuccessRank: true }) }).status,
    ).toBe(s);
  });
});

describe('SEMESTER_WINDOW', () => {
  const cap = rule('SEMESTER_WINDOW', { byDuration: { ONLISANS: [2, 3], '4': [3, 5], '5': [3, 7], '6': [3, 9] } });
  it.each([
    [4, 2, 'FAIL'],
    [4, 3, 'PASS'],
    [4, 5, 'PASS'],
    [4, 6, 'FAIL'],
    [5, 7, 'PASS'],
    [5, 8, 'FAIL'],
    [6, 9, 'PASS'],
    [6, 10, 'FAIL'],
  ])('%s yıllık, %s. yarıyıl → %s', (d, sem, s) => {
    expect(evaluateRule(cap, { student: student({ durationYears: d, semesterNo: sem }) }).status).toBe(s);
  });
  it.each([
    [1, 'FAIL'],
    [2, 'PASS'],
    [3, 'PASS'],
    [4, 'FAIL'],
  ])('ön lisans %s. yarıyıl → %s', (sem, s) => {
    expect(evaluateRule(cap, { student: student({ level: 'ONLISANS', durationYears: 2, semesterNo: sem }) }).status).toBe(s);
  });
  it('tanımsız süre → FAIL', () => {
    expect(evaluateRule(cap, { student: student({ durationYears: 3 }) }).status).toBe('FAIL');
  });
  it('yan dal "*" aralığı 3–6', () => {
    const yd = rule('SEMESTER_WINDOW', { byDuration: { '*': [3, 6] } });
    expect(evaluateRule(yd, { student: student({ semesterNo: 6 }) }).status).toBe('PASS');
    expect(evaluateRule(yd, { student: student({ semesterNo: 7 }) }).status).toBe('FAIL');
  });
});

describe('MAX_ACTIVE_TRACKS', () => {
  const r = rule('MAX_ACTIVE_TRACKS', { max: 1 });
  it('etkin yok → PASS', () => {
    expect(evaluateRule(r, { enrollments: [enr({ status: 'WITHDRAWN' })], offering: offering() }).status).toBe('PASS');
  });
  it('etkin ÇAP var → FAIL', () => {
    expect(evaluateRule(r, { enrollments: [enr()], offering: offering() }).status).toBe('FAIL');
  });
  it('dondurulmuş da sayılır', () => {
    expect(evaluateRule(r, { enrollments: [enr({ status: 'FROZEN' })], offering: offering() }).status).toBe('FAIL');
  });
  it('yan dal kaydı ÇAP sayısına girmez; yan dal etiketi', () => {
    expect(evaluateRule(r, { enrollments: [enr({ type: 'YANDAL' })], offering: offering() }).status).toBe('PASS');
    expect(evaluateRule(r, { enrollments: [enr({ type: 'YANDAL' })], offering: offering({ type: 'YANDAL' }) }).message).toContain('yan dal');
  });
});

describe('NOT_SAME_PROGRAM_BOTH', () => {
  const r = rule('NOT_SAME_PROGRAM_BOTH');
  it('aynı programda yan dal varken ÇAP → FAIL', () => {
    expect(
      evaluateRule(r, { enrollments: [enr({ programId: 'P-IKTISAT', type: 'YANDAL' })], offering: offering() }).status,
    ).toBe('FAIL');
  });
  it('farklı program → PASS', () => {
    expect(evaluateRule(r, { enrollments: [enr({ type: 'YANDAL' })], offering: offering() }).status).toBe('PASS');
  });
  it('aynı programda bırakılmış kayıt → PASS', () => {
    expect(
      evaluateRule(r, { enrollments: [enr({ programId: 'P-IKTISAT', type: 'YANDAL', status: 'WITHDRAWN' })], offering: offering() }).status,
    ).toBe('PASS');
  });
});

describe('NOT_OWN_PROGRAM', () => {
  it('kendi programı → FAIL', () => {
    expect(evaluateRule(rule('NOT_OWN_PROGRAM'), { student: student({ programId: 'P-IKTISAT' }), offering: offering() }).status).toBe('FAIL');
  });
  it('farklı → PASS', () => {
    expect(evaluateRule(rule('NOT_OWN_PROGRAM'), { student: student(), offering: offering() }).status).toBe('PASS');
  });
});

describe('TALENT_EXAM_PASSED', () => {
  const r = rule('TALENT_EXAM_PASSED');
  it('şart yok → NA', () => {
    expect(evaluateRule(r, { student: student(), offering: offering() }).status).toBe('NOT_APPLICABLE');
  });
  it('geçmiş → PASS / geçmemiş → FAIL', () => {
    const o = offering({ requiresTalentExam: true });
    expect(evaluateRule(r, { student: student({ talentExamPassedProgramIds: ['P-IKTISAT'] }), offering: o }).status).toBe('PASS');
    expect(evaluateRule(r, { student: student(), offering: o }).status).toBe('FAIL');
  });
});

describe('SOURCE_PROGRAM_ALLOWED', () => {
  const r = rule('SOURCE_PROGRAM_ALLOWED');
  it('liste boş → PASS', () => {
    expect(evaluateRule(r, { student: student(), offering: offering() }).status).toBe('PASS');
  });
  it('listede → PASS, değil → FAIL', () => {
    const o = offering({ sourceProgramIds: ['P-ISLETME'] });
    expect(evaluateRule(r, { student: student(), offering: o }).status).toBe('PASS');
    expect(evaluateRule(r, { student: student({ programId: 'P-TARIH' }), offering: o }).status).toBe('FAIL');
  });
});

describe('MIN_QUOTA_RATIO', () => {
  const r = rule('MIN_QUOTA_RATIO', { percent: 20, exemptCategories: ['MUHENDISLIK'] });
  it('yan dal → NA', () => {
    expect(evaluateRule(r, { offering: offering({ type: 'YANDAL' }) }).status).toBe('NOT_APPLICABLE');
  });
  it('muaf kategori → NA', () => {
    expect(evaluateRule(r, { offering: offering({ programCategory: 'MUHENDISLIK', quota: 1 }) }).status).toBe('NOT_APPLICABLE');
  });
  it('mevcut bilinmiyor → WARN', () => {
    expect(evaluateRule(r, { offering: offering({ firstYearIntake: null }) }).status).toBe('WARN');
  });
  it.each([
    [7, 'WARN'],
    [8, 'PASS'],
  ])('40 mevcut, kontenjan %s → %s', (quota, s) => {
    expect(evaluateRule(r, { offering: offering({ quota }) }).status).toBe(s);
  });
  it('exemptCategories verilmezse muafiyet yok', () => {
    expect(evaluateRule(rule('MIN_QUOTA_RATIO', { percent: 20 }), { offering: offering({ quota: 8 }) }).status).toBe('PASS');
  });
});

describe('CONSECUTIVE_TERMS_NO_COURSE', () => {
  const r = rule('CONSECUTIVE_TERMS_NO_COURSE', { terms: 2 });
  it.each([
    [0, 'PASS'],
    [1, 'WARN'],
    [2, 'FAIL'],
  ])('%s dönem → %s', (n, s) => {
    expect(evaluateRule(r, { history: history({ consecutiveTermsWithoutCourse: n }) }).status).toBe(s);
  });
  it('dondurulmuşsa NA', () => {
    expect(evaluateRule(r, { history: history({ consecutiveTermsWithoutCourse: 5 }), student: student({ frozen: true }) }).status).toBe('NOT_APPLICABLE');
  });
});

describe('GANO_DROP_STRIKES (KR-ÇAP-11, YÖK m.17/4)', () => {
  const r = rule('GANO_DROP_STRIKES', { threshold: 2.72, floor: 2.5, allowedStrikes: 1 });
  it('2.72 → PASS', () => {
    expect(evaluateRule(r, { history: history({ mainGano: 2.72 }) }).status).toBe('PASS');
  });
  it('ilk düşüş 2.71 → WARN + sayaç etkisi', () => {
    const res = evaluateRule(r, { history: history({ mainGano: 2.71 }) });
    expect(res.status).toBe('WARN');
    expect(res.effects?.incrementGanoStrikes).toBe(true);
  });
  it('ilk düşüş tam 2.50 → WARN (65\'e kadar izinli)', () => {
    expect(evaluateRule(r, { history: history({ mainGano: 2.5 }) }).status).toBe('WARN');
  });
  it('ilk düşüş 2.49 → FAIL (izin 2,50\'ye kadar)', () => {
    const res = evaluateRule(r, { history: history({ mainGano: 2.49 }) });
    expect(res.status).toBe('FAIL');
    expect(res.expected).toBe(2.5);
  });
  it('ikinci düşüş → FAIL', () => {
    expect(evaluateRule(r, { history: history({ mainGano: 2.6, ganoStrikes: 1 }) }).status).toBe('FAIL');
  });
});

describe('MAIN_GANO_BELOW (KR-YD-06)', () => {
  const r = rule('MAIN_GANO_BELOW', { min: 2.3, warnMargin: 0.15 });
  it.each([
    [2.29, 'FAIL'],
    [2.3, 'WARN'],
    [2.44, 'WARN'],
    [2.45, 'PASS'],
  ])('%s → %s', (g, s) => {
    expect(evaluateRule(r, { history: history({ mainGano: g }) }).status).toBe(s);
  });
});

describe('TRACK_GPA_CONSECUTIVE_BELOW (KR-YD-07)', () => {
  const r = rule('TRACK_GPA_CONSECUTIVE_BELOW', { min: 2, terms: 2 });
  it.each([
    [[], 'NOT_APPLICABLE'],
    [[1.9], 'WARN'],
    [[1.9, 1.99], 'FAIL'],
    [[2.5, 1.9], 'WARN'],
    [[1.9, 2.0], 'PASS'],
  ])('%j → %s', (list, s) => {
    expect(evaluateRule(r, { history: history({ trackGpaByTerm: list as number[] }) }).status).toBe(s);
  });
});

describe('NOT_PREVIOUSLY_REMOVED', () => {
  const r = rule('NOT_PREVIOUSLY_REMOVED');
  it('silinmiş → FAIL, değil → PASS', () => {
    expect(evaluateRule(r, { offering: offering(), previouslyRemovedProgramIds: ['P-IKTISAT'] }).status).toBe('FAIL');
    expect(evaluateRule(r, { offering: offering(), previouslyRemovedProgramIds: [] }).status).toBe('PASS');
  });
});

describe('MINOR_PLAN_LIMITS (KR-YD-05)', () => {
  const r = rule('MINOR_PLAN_LIMITS', { minEcts: 30, minCourses: 6, poolMinEcts: 60 });
  it.each([
    [59, 30, 6, 'FAIL'],
    [60, 30, 6, 'PASS'],
    [60, 29, 6, 'FAIL'],
    [60, 30, 5, 'FAIL'],
  ])('havuz %s, plan %s AKTS / %s ders → %s', (pool, ects, n, s) => {
    expect(evaluateRule(r, { minorPlan: { poolEcts: pool, planEcts: ects, planCourseCount: n } }).status).toBe(s);
  });
});

describe('GRADUATION_CAP', () => {
  const r = rule('GRADUATION_CAP', { minMainGano: 2.72 });
  const g = { mainGraduated: true, mainGano: 3, trackCompleted: true, trackEcts: 240, requiredEcts: 240, trackGpa: 3 };
  it('tümü tamam → PASS', () => {
    expect(evaluateRule(r, { graduation: g }).status).toBe('PASS');
  });
  it('eksikler listelenir', () => {
    const res = evaluateRule(r, { graduation: { ...g, mainGraduated: false, mainGano: 2.71, trackEcts: 200 } });
    expect(res.status).toBe('FAIL');
    expect(res.message).toContain('ana daldan mezuniyet');
    expect(res.message).toContain('2,72');
    expect(res.message).toContain('200/240');
  });
  it('program tamamlanmamış', () => {
    expect(evaluateRule(r, { graduation: { ...g, trackCompleted: false } }).status).toBe('FAIL');
  });
});

describe('GRADUATION_MINOR', () => {
  const r = rule('GRADUATION_MINOR', { minTrackGpa: 2 });
  const g = { mainGraduated: true, mainGano: 3, trackCompleted: true, trackEcts: 30, requiredEcts: 30, trackGpa: 2 };
  it('tamam → PASS', () => {
    expect(evaluateRule(r, { graduation: g }).status).toBe('PASS');
  });
  it('eksikler', () => {
    const res = evaluateRule(r, { graduation: { ...g, mainGraduated: false, trackCompleted: false, trackGpa: null } });
    expect(res.status).toBe('FAIL');
    expect(res.message).toContain('yan dal planının');
  });
  it('ortalama düşük', () => {
    expect(evaluateRule(r, { graduation: { ...g, trackGpa: 1.99 } }).status).toBe('FAIL');
  });
});

describe('FROZEN_WITH_MAIN', () => {
  it('dondurulmuş → WARN + dondurma etkisi', () => {
    const res = evaluateRule(rule('FROZEN_WITH_MAIN'), { student: student({ frozen: true }) });
    expect(res.status).toBe('WARN');
    expect(res.effects?.freezeEnrollment).toBe(true);
  });
  it('etkin → PASS', () => {
    expect(evaluateRule(rule('FROZEN_WITH_MAIN'), { student: student() }).status).toBe('PASS');
  });
});

describe('ANY_OF (KR-ÇAP-03)', () => {
  const r = rule('ANY_OF', {
    rules: [
      { code: 'a', kind: 'CLASS_RANK_TOP', title: 'Sınıfında en üst %20', params: { percent: 20 } },
      { code: 'b', kind: 'ENTRY_SCORE_GTE_BASE', title: 'YKS puanı ≥ taban puan', params: {} },
    ],
  });
  it('sıralama yolu → PASS', () => {
    const res = evaluateRule(r, { student: student(), offering: offering() });
    expect(res.status).toBe('PASS');
    expect(res.children).toHaveLength(2);
  });
  it('yalnızca YKS yolu, doğrulanmamış → CONDITIONAL', () => {
    expect(evaluateRule(r, { student: student({ classRankPercentile: 35 }), offering: offering() }).status).toBe('CONDITIONAL');
  });
  it('YKS yolu doğrulanmış → PASS', () => {
    expect(
      evaluateRule(r, { student: student({ classRankPercentile: 35 }), offering: offering(), osymVerified: true }).status,
    ).toBe('PASS');
  });
  it('hiçbiri → FAIL', () => {
    expect(
      evaluateRule(r, { student: student({ classRankPercentile: 35, entryScore: { year: 2025, score: 100 } }), offering: offering() }).status,
    ).toBe('FAIL');
  });
});
