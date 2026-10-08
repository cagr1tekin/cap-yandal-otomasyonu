import { LABELS, type CourseState, type RequestStatus, type ReviewStatus, type StudentStatus } from '@cap/contracts';
import type { RuleResult } from '@cap/rules';
import { CheckCircle2, CircleDashed, CircleHelp, MinusCircle, TriangleAlert, XCircle } from 'lucide-react';
import { Badge, type Tone } from '@/components/ui';

const reviewTone: Record<ReviewStatus, Tone> = { PENDING: 'warn', APPROVED: 'ok', REJECTED: 'bad', CANCELLED: 'muted' };

export function ReviewBadge({ value }: { value: ReviewStatus }) {
  return <Badge tone={reviewTone[value]}>{LABELS.review[value]}</Badge>;
}

const stateTone: Record<CourseState, Tone> = { PLANLANDI: 'muted', ALINDI: 'neutral', GECTI: 'ok', KALDI: 'bad', MUAF: 'accent', CIKARILDI: 'muted' };

export function CourseStateBadge({ value }: { value: CourseState }) {
  return <Badge tone={stateTone[value]}>{LABELS.courseState[value]}</Badge>;
}

const studentTone: Record<StudentStatus, Tone> = { ACTIVE: 'ok', FROZEN: 'warn', GRADUATED: 'neutral', CERTIFIED: 'neutral', WITHDRAWN: 'muted', REMOVED: 'bad' };

export function StudentStatusBadge({ value }: { value: StudentStatus }) {
  return <Badge tone={studentTone[value]}>{LABELS.studentStatus[value]}</Badge>;
}

const requestTone: Record<RequestStatus, Tone> = { OPEN: 'warn', UPLOADED: 'neutral', APPROVED: 'ok', REJECTED: 'bad', CANCELLED: 'muted' };

export function RequestBadge({ value }: { value: RequestStatus }) {
  return <Badge tone={requestTone[value]}>{LABELS.request[value]}</Badge>;
}

export function WorstBadge({ value }: { value: 'OK' | 'WARN' | 'FAIL' | null }) {
  if (value === 'FAIL') return <Badge tone="bad">Kayıt silme uyarısı</Badge>;
  if (value === 'WARN') return <Badge tone="warn">Uyarı</Badge>;
  if (value === 'OK') return <Badge tone="ok">Sorun yok</Badge>;
  return <Badge tone="muted">Kontrol yok</Badge>;
}

const ruleIcon = {
  PASS: { Icon: CheckCircle2, cls: 'text-ok', label: 'Sağlandı' },
  FAIL: { Icon: XCircle, cls: 'text-bad', label: 'Sağlanmadı' },
  WARN: { Icon: TriangleAlert, cls: 'text-warn', label: 'Uyarı' },
  CONDITIONAL: { Icon: CircleHelp, cls: 'text-warn', label: 'Koşullu' },
  NOT_APPLICABLE: { Icon: MinusCircle, cls: 'text-su-subtle', label: 'Uygulanmaz' },
} as const;

/** Her kuralın durumu, değeri ve dayanak maddesi. */
export function RuleList({ results, hideNa = false }: { results: RuleResult[]; hideNa?: boolean }) {
  const list = hideNa ? results.filter((r) => r.status !== 'NOT_APPLICABLE') : results;
  if (!list.length) return <p className="text-sm text-su-muted">Uygulanan kural yok.</p>;
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
            </div>
          </li>
        );
      })}
    </ul>
  );
}
