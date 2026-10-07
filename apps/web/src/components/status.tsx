import { LABELS, type ApplicationStatus, type EnrollmentStatus } from '@cap/contracts';
import type { RuleResult, Verdict } from '@cap/rules';
import { CheckCircle2, CircleDashed, CircleHelp, MinusCircle, TriangleAlert, XCircle } from 'lucide-react';
import { Badge, type Tone } from '@/components/ui';

const verdict: Record<Verdict, { tone: Tone; label: string; Icon: typeof CheckCircle2 }> = {
  ELIGIBLE: { tone: 'ok', label: 'Uygun', Icon: CheckCircle2 },
  CONDITIONAL: { tone: 'warn', label: 'Koşullu', Icon: CircleHelp },
  INELIGIBLE: { tone: 'bad', label: 'Uygun değil', Icon: XCircle },
};

export function VerdictBadge({ value }: { value: Verdict }) {
  const v = verdict[value];
  return (
    <Badge tone={v.tone}>
      <v.Icon aria-hidden className="size-3.5" />
      {v.label}
    </Badge>
  );
}

const appTone: Record<ApplicationStatus, Tone> = {
  SUBMITTED: 'neutral',
  WITHDRAWN: 'muted',
  UNDER_REVIEW: 'neutral',
  PROPOSED: 'neutral',
  ACCEPTED: 'ok',
  WAITLISTED: 'warn',
  REJECTED: 'bad',
  ENROLLED: 'ok',
  NOT_ENROLLED: 'muted',
};

export function ApplicationBadge({ value }: { value: ApplicationStatus }) {
  return <Badge tone={appTone[value]}>{LABELS.application[value]}</Badge>;
}

const enrollTone: Record<EnrollmentStatus, Tone> = {
  ACTIVE: 'ok',
  FROZEN: 'warn',
  WITHDRAWN: 'muted',
  REMOVED: 'bad',
  COMPLETED: 'neutral',
};

export function EnrollmentBadge({ value }: { value: EnrollmentStatus }) {
  return <Badge tone={enrollTone[value]}>{LABELS.enrollment[value]}</Badge>;
}

const ruleIcon = {
  PASS: { Icon: CheckCircle2, cls: 'text-ok', label: 'Sağlandı' },
  FAIL: { Icon: XCircle, cls: 'text-bad', label: 'Sağlanmadı' },
  WARN: { Icon: TriangleAlert, cls: 'text-warn', label: 'Uyarı' },
  CONDITIONAL: { Icon: CircleHelp, cls: 'text-warn', label: 'Koşullu' },
  NOT_APPLICABLE: { Icon: MinusCircle, cls: 'text-su-subtle', label: 'Uygulanmaz' },
} as const;

/** US-01: her kuralın durumu, değeri ve kaynak maddesi. */
export function RuleList({ results, hideNa = false }: { results: RuleResult[]; hideNa?: boolean }) {
  const list = hideNa ? results.filter((r) => r.status !== 'NOT_APPLICABLE') : results;
  return (
    <ul className="divide-y divide-su-border/60">
      {list.map((r) => {
        const i = ruleIcon[r.status] ?? { Icon: CircleDashed, cls: '', label: r.status };
        return (
          <li key={r.code} className="flex gap-3 py-2.5">
            <i.Icon aria-label={i.label} className={`mt-0.5 size-4.5 shrink-0 ${i.cls}`} />
            <div className="min-w-0 text-sm">
              <p>
                <span className="font-medium text-su-heading">{r.title}</span>{' '}
                <span className="text-xs text-su-subtle">
                  {r.code} · {r.article}
                </span>
              </p>
              <p className="text-su-muted">{r.message}</p>
              {r.children && (
                <ul className="mt-1 space-y-0.5 border-l-2 border-su-border pl-3 text-xs text-su-muted">
                  {r.children.map((c) => (
                    <li key={c.code}>
                      <span className={ruleIcon[c.status]?.cls}>●</span> {c.title}: {c.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
