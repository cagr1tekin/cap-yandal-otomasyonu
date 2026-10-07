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

  it('uygun ÇAP adayı', () => {
    const out = evaluate(CAP_RULE_SET_V1, 'APPLICATION', {
      student: student(),
      offering: offering(),
      enrollments: [],
    });
    expect(out.verdict).toBe('ELIGIBLE');
  });

  it('kaynak bölüm dışı mühendislik başvurusu reddedilir', () => {
    const out = evaluate(CAP_RULE_SET_V1, 'APPLICATION', {
      student: student({ programId: 'P-TARIH' }),
      offering: offering({ programCategory: 'MUHENDISLIK', sourceProgramIds: ['P-EEM'] }),
      enrollments: [],
    });
    expect(out.verdict).toBe('INELIGIBLE');
    expect(out.results.find((r) => r.code === 'KR-ÇAP-08')?.status).toBe('FAIL');
  });

  it('yan dal 2.50 sınırı ve 7. yarıyıl', () => {
    const out = evaluate(YANDAL_RULE_SET_V1, 'APPLICATION', {
      student: student({ gano: 2.49, semesterNo: 7 }),
      offering: offering({ type: 'YANDAL' }),
      enrollments: [],
      previouslyRemovedProgramIds: [],
    });
    const failed = out.results.filter((r) => r.status === 'FAIL').map((r) => r.code);
    expect(failed).toEqual(['KR-YD-02', 'KR-YD-03']);
  });

  it('dönem sonu ÇAP taraması', () => {
    const out = evaluate(CAP_RULE_SET_V1, 'TERM_END', {
      student: student(),
      history: { mainGano: 2.6, trackGpaByTerm: [2.5], consecutiveTermsWithoutCourse: 0, ganoStrikes: 1 },
    });
    expect(out.results.find((r) => r.code === 'KR-ÇAP-11')?.status).toBe('FAIL');
  });
});
