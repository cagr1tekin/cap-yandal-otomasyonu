import { LABELS, type EnrollmentStatus, type FindingDecision, type TrackType } from '@cap/contracts';
import type { RuleResult } from '@cap/rules';
import { ActionForm, SubmitButton } from '@/components/forms';
import { EnrollmentBadge } from '@/components/status';
import { Alert, Badge, Card, CardTitle, Empty, Field, Input, Page, PageHero, Stat } from '@/components/ui';
import { api } from '@/lib/api';
import { fmtDateTime, termLabel } from '@/lib/format';
import { findingAction } from '@/lib/staff-actions';
import type { Term } from '@/lib/types';
import { AutoRefresh } from './auto-refresh';

export const metadata = { title: 'Tarama sonuçları' };

interface Finding {
  id: string;
  studentNo: string;
  fullName: string;
  programName: string;
  type: TrackType;
  enrollmentStatus: EnrollmentStatus;
  ruleCode: string;
  status: 'WARN' | 'FAIL';
  result: RuleResult;
  decision: FindingDecision;
  decidedBy: string | null;
  decidedAt: string | null;
  reason: string | null;
}

interface ScanDetail {
  id: string;
  status: 'QUEUED' | 'RUNNING' | 'DONE' | 'FAILED';
  error: string | null;
  createdAt: string;
  finishedAt: string | null;
  term: Term;
  ruleSets: { version: string; type: string }[];
  findings: Finding[];
}

export default async function ScanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await api<ScanDetail>(`/scans/${id}`);
  const fails = s.findings.filter((f) => f.status === 'FAIL');
  const pending = s.findings.filter((f) => f.decision === 'PENDING');

  return (
    <>
      <PageHero
        title="Tarama sonuçları"
        crumbs={['Birim', 'Taramalar', termLabel(s.term)]}
        subtitle={`Başlangıç ${fmtDateTime(s.createdAt)} · kural setleri: ${s.ruleSets.map((r) => r.version).join(', ')}`}
      />
      <Page>
        {(s.status === 'QUEUED' || s.status === 'RUNNING') && (
          <Alert tone="info" title="Tarama sürüyor…">
            Sayfa birkaç saniyede bir yenilenir. <AutoRefresh />
          </Alert>
        )}
        {s.status === 'FAILED' && <Alert tone="bad" title="Tarama başarısız oldu.">{s.error}</Alert>}
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Bulgu" value={s.findings.length} />
          <Stat label="Kayıt silme adayı" value={fails.length} hint="FAIL" />
          <Stat label="Karar bekleyen" value={pending.length} />
        </div>
        {s.status === 'DONE' && s.findings.length === 0 && <Empty>Bulgu yok: tüm kayıtlar koşulları sağlıyor.</Empty>}
        <div className="space-y-3">
          {s.findings.map((f) => (
            <Card key={f.id} className="space-y-3 p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-su-subtle">
                    {LABELS.track[f.type]} · {f.programName}
                  </p>
                  <h2 className="text-base font-semibold">
                    {f.fullName} <span className="text-sm font-normal text-su-subtle">{f.studentNo}</span>
                  </h2>
                </div>
                <div className="flex gap-2">
                  <Badge tone={f.status === 'FAIL' ? 'bad' : 'warn'}>{f.status === 'FAIL' ? 'Kayıt silme adayı' : 'Uyarı'}</Badge>
                  <EnrollmentBadge value={f.enrollmentStatus} />
                </div>
              </div>
              <p className="text-sm">
                <span className="font-medium">{f.result.title}</span> ({f.ruleCode} · {f.result.article}): {f.result.message}
              </p>
              {f.result.effects?.incrementGanoStrikes && (
                <p className="text-xs text-su-muted">Onaylanırsa öğrencinin GNO düşüş sayacı bir artırılır.</p>
              )}
              {f.decision === 'PENDING' ? (
                <ActionForm action={findingAction} className="rounded-lg bg-su-bg p-3">
                  <input type="hidden" name="findingId" value={f.id} />
                  <Field label="Gerekçe (karar sayısı vb.)">
                    <Input name="reason" required minLength={5} placeholder="Yönetim kurulu 2026/46-2" />
                  </Field>
                  <div className="flex flex-wrap gap-2">
                    <DecisionButtons fail={f.status === 'FAIL'} />
                  </div>
                </ActionForm>
              ) : (
                <p className="text-xs text-su-muted">
                  {LABELS.finding[f.decision]} — {f.decidedBy}, {fmtDateTime(f.decidedAt)}
                  {f.reason && `: ${f.reason}`}
                </p>
              )}
            </Card>
          ))}
        </div>
      </Page>
    </>
  );
}

function DecisionButtons({ fail }: { fail: boolean }) {
  return (
    <>
      <SubmitButton
        variant={fail ? 'danger' : 'primary'}
        size="sm"
        name="decision"
        value="CONFIRMED"
        confirm={fail ? 'Onaylarsanız öğrencinin kaydı silinecek. Devam edilsin mi?' : undefined}
      >
        {fail ? 'Onayla (kaydı sil)' : 'Onayla'}
      </SubmitButton>
      <SubmitButton variant="outline" size="sm" name="decision" value="DISMISSED">
        Reddet
      </SubmitButton>
    </>
  );
}
