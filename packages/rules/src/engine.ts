import { evaluateRule } from './evaluators';
import type {
  EvaluationContext,
  EvaluationOutcome,
  RulePhase,
  RuleResult,
  RuleSetDefinition,
  Verdict,
} from './types';

export function verdictOf(results: RuleResult[]): Verdict {
  if (results.some((r) => r.status === 'FAIL')) return 'INELIGIBLE';
  if (results.some((r) => r.status === 'CONDITIONAL')) return 'CONDITIONAL';
  return 'ELIGIBLE';
}

/** Kural setindeki belirtilen aşamaya ait kuralları çalıştırır. */
export function evaluate(
  ruleSet: RuleSetDefinition,
  phase: RulePhase,
  ctx: EvaluationContext,
): EvaluationOutcome {
  const results = ruleSet.rules
    .filter((r) => r.phase === phase)
    .map((r) => evaluateRule(r, ctx));
  return { verdict: verdictOf(results), results };
}

export const VERDICT_LABELS: Record<Verdict, string> = {
  ELIGIBLE: 'Uygun',
  CONDITIONAL: 'Koşullu',
  INELIGIBLE: 'Uygun değil',
};
