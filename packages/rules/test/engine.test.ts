import { describe, expect, it } from 'vitest';
import { CAP_RULE_SET_V1, DEFAULT_RULE_SETS, evaluate, verdictOf, VERDICT_LABELS, YANDAL_RULE_SET_V1 } from '../src';
import type { RuleResult } from '../src';
import { offering, student } from './helpers';

const res = (status: RuleResult['status']): RuleResult => ({
  code: 'x', kind: 'x', article: 'x', title: 'x', status, message: '',
});

describe('verdictOf', () => {
  it('FAIL baskın', () => expect(verdictOf([res('PASS'), res('CONDITIONAL'), res('FAIL')])).toBe('INELIGIBLE'));
  it('CONDITIONAL', () => expect(verdictOf([res('PASS'), res('CONDITIONAL'), res('WARN')])).toBe('CONDITIONAL'));
  it('ELIGIBLE', () => expect(verdictOf([res('PASS'), res('WARN'), res('NOT_APPLICABLE')])).toBe('ELIGIBLE'));
  it('etiketler', () => expect(VERDICT_LABELS.CONDITIONAL).toBe('Koşullu'));
});

describe('varsayılan kural setleri', () => {
  it('iki set var ve kodlar benzersiz', () => {
    expect(DEFAULT_RULE_SETS).toHaveLength(2);
    for (const set of DEFAULT_RULE_SETS) {
      const codes = set.rules.map((r) => r.code);
      expect(new Set(codes).size).toBe(codes.length);
    }
  });

  it('başvuru aşaması kuralı yok (değerlendirmeyi dekanlık yapar)', () => {
    for (const set of DEFAULT_RULE_SETS) expect(set.rules.some((r) => r.phase === 'APPLICATION')).toBe(false);
    expect(evaluate(CAP_RULE_SET_V1, 'APPLICATION', { student: student(), offering: offering(), enrollments: [] }).verdict).toBe('ELIGIBLE');
  });

  it('yan dal ders listesi ve mezuniyet sonrası süre', () => {
    const plan = evaluate(YANDAL_RULE_SET_V1, 'PROTOCOL', { minorPlan: { poolEcts: 240, planEcts: 28, planCourseCount: 7 } });
    expect(plan.results.find((r) => r.code === 'KR-YD-05')?.status).toBe('FAIL');
    const term = evaluate(YANDAL_RULE_SET_V1, 'TERM_END', {
      student: student(),
      history: { mainGano: 2.5, trackGpaByTerm: [2.4], consecutiveTermsWithoutCourse: 0, ganoStrikes: 0, termsSinceMainGraduation: 3 },
    });
    expect(term.results.find((r) => r.code === 'KR-YD-14')?.status).toBe('FAIL');
  });

  it('dönem sonu ÇAP taraması', () => {
    const out = evaluate(CAP_RULE_SET_V1, 'TERM_END', {
      student: student(),
      history: { mainGano: 2.6, trackGpaByTerm: [2.5], consecutiveTermsWithoutCourse: 0, ganoStrikes: 1 },
    });
    expect(out.results.find((r) => r.code === 'KR-ÇAP-11')?.status).toBe('FAIL');
  });
});
