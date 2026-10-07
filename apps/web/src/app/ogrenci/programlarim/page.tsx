import { ExternalLink as ExtIcon } from 'lucide-react';
import { LABELS } from '@cap/contracts';
import { ActionForm, SubmitButton } from '@/components/forms';
import { EnrollmentBadge, RuleList } from '@/components/status';
import { Alert, Badge, Card, CardTitle, Empty, Field, Page, PageHero, Progress, Textarea } from '@/components/ui';
import { api } from '@/lib/api';
import { fmtDate, fmtGpa } from '@/lib/format';
import type { EnrollmentView, ExternalLink } from '@/lib/types';
import { savePlanAction, withdrawEnrollmentAction } from '../actions';

export const metadata = { title: 'Programlarım' };

function MinorPlan({ e }: { e: EnrollmentView }) {
  const chosen = new Set(e.plan.map((p) => p.course.id));
  const approved = e.plan.length > 0 && e.plan.every((p) => p.status === 'APPROVED');
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-semibold">Yan dal ders planı</h3>
        {e.plan.length === 0 ? <Badge tone="muted">Plan yok</Badge> : approved ? <Badge tone="ok">Onaylandı</Badge> : <Badge tone="warn">Onay bekliyor</Badge>}
      </div>
      <p className="text-xs text-su-muted">En az 30 AKTS ve en az 6 ders seçin (Yan Dal Yön. m.5/1-g). Onaylanan derslerin kaydı OBİS'ten yapılır.</p>
      <ActionForm action={savePlanAction}>
        <input type="hidden" name="enrollmentId" value={e.id} />
        <fieldset className="grid gap-2 sm:grid-cols-2" disabled={e.status !== 'ACTIVE'}>
          <legend className="sr-only">Havuzdaki dersler</legend>
          {e.pool.map((c) => (
            <label key={c.id} className="flex items-center gap-2 rounded-lg border border-su-border/70 bg-white px-3 py-2 text-sm">
              <input type="checkbox" name="course" value={c.id} defaultChecked={chosen.has(c.id)} className="size-4 accent-[var(--color-su-primary)]" />
              <span className="font-mono text-xs text-su-subtle">{c.courseCode}</span>
              <span className="flex-1">{c.name}</span>
              <span className="text-xs text-su-muted">{c.ects} AKTS</span>
            </label>
          ))}
        </fieldset>
        {e.status === 'ACTIVE' && <SubmitButton size="sm">Planı onaya gönder</SubmitButton>}
      </ActionForm>
    </div>
  );
}

function Withdraw({ e }: { e: EnrollmentView }) {
  return (
    <details className="rounded-xl border border-su-border/70 px-4 py-3">
      <summary className="text-sm font-medium text-bad">Programdan ayrıl</summary>
      <ActionForm action={withdrawEnrollmentAction} className="mt-3">
        <input type="hidden" name="enrollmentId" value={e.id} />
        {e.type === 'CAP' && (
          <Alert tone="info">
            Çift ana daldan ayrılırsanız, aldığınız dersler aynı programın yan dal gereklerini karşılıyorsa yan dal sertifikası hakkı doğar (ÇAP Yön.
            m.8/1-g). Sonuç ayrıldıktan sonra burada gösterilir.
          </Alert>
        )}
        <Field label="Gerekçe" htmlFor={`r-${e.id}`}>
          <Textarea id={`r-${e.id}`} name="reason" required minLength={5} />
        </Field>
        <SubmitButton variant="danger" size="sm" confirm="Programdan ayrılmak istediğinize emin misiniz? Bu işlem geri alınamaz.">
          Ayrılmayı onayla
        </SubmitButton>
      </ActionForm>
    </details>
  );
}

export default async function MyPrograms() {
  const data = await api<{ items: EnrollmentView[]; links: ExternalLink[] }>('/me/enrollments');
  const dersKaydi = data.links.find((l) => l.key === 'obis-ders');
  const muafiyet = data.links.find((l) => l.key === 'birim-muafiyet');

  return (
    <>
      <PageHero title="Programlarım" crumbs={['Öğrenci']} subtitle="Kayıtlı olduğunuz çift ana dal ve yan dal programları, ilerlemeniz ve uyarılar." />
      <Page>
        {data.items.length === 0 && <Empty>Kayıtlı olduğunuz bir çift ana dal veya yan dal programı yok.</Empty>}
        {data.items.map((e) => {
          const active = e.status === 'ACTIVE' || e.status === 'FROZEN';
          const outcome = e.withdrawals[0]?.capToMinorOutcome;
          return (
            <Card key={e.id} className="space-y-5">
              <CardTitle aside={<EnrollmentBadge value={e.status} />}>
                <span className="block text-xs uppercase tracking-wide text-su-subtle">{LABELS.track[e.type]}</span>
                {e.program.name}
                <span className="block text-sm font-normal text-su-muted">
                  {e.program.unitName} · kayıt {fmtDate(e.createdAt)}
                </span>
              </CardTitle>

              {e.warnings.length > 0 && (
                <div className="space-y-2">
                  {e.warnings.map((w) => (
                    <Alert key={w.id} tone={w.status === 'FAIL' ? 'bad' : 'warn'} title={`${w.result.title} (${w.ruleCode})`}>
                      {w.result.message} <span className="text-xs">— {w.result.article}</span>
                      {w.decision === 'PENDING' && <span className="block text-xs">Birim kararı bekleniyor.</span>}
                    </Alert>
                  ))}
                </div>
              )}

              {e.progress && (
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="sm:col-span-2">
                    <Progress value={e.progress.trackEcts} max={e.progress.requiredEcts} label="Tamamlanan AKTS" />
                  </div>
                  <div className="text-sm">
                    <p className="text-su-muted">Ana dal GNO · program ortalaması</p>
                    <p className="font-semibold text-su-primary">
                      {fmtGpa(e.progress.mainGano)} · {fmtGpa(e.progress.trackGpa)}
                    </p>
                  </div>
                </div>
              )}

              {e.progress?.graduation && (
                <details className="rounded-lg bg-su-bg px-3 py-2">
                  <summary className="text-sm font-medium text-su-primary">{e.type === 'CAP' ? 'Diploma' : 'Sertifika'} koşulları</summary>
                  <RuleList results={[e.progress.graduation]} />
                </details>
              )}

              {e.progress && e.progress.courses.length > 0 && (
                <details className="rounded-lg bg-su-bg px-3 py-2">
                  <summary className="text-sm font-medium text-su-primary">Bu programda alınan dersler ({e.progress.courses.length})</summary>
                  <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                    {e.progress.courses.map((c) => (
                      <li key={c.code} className="flex justify-between gap-2">
                        <span>
                          <span className="font-mono text-xs text-su-subtle">{c.code}</span> {c.name}
                        </span>
                        <span className={c.passed ? 'text-ok' : 'text-bad'}>{c.grade}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              {e.type === 'YANDAL' && active && <MinorPlan e={e} />}

              {outcome?.hasMinorProgram && (
                <Alert tone={outcome.eligibleForCertificate ? 'ok' : 'info'} title="Çift ana daldan ayrılma sonucu">
                  <p>{outcome.message}</p>
                  {outcome.passedPoolCourses && (
                    <p className="mt-1 text-xs">
                      Yan dal havuzundan geçilen dersler ({outcome.passedPoolEcts} AKTS): {outcome.passedPoolCourses.join(', ')}
                    </p>
                  )}
                  {muafiyet && (
                    <p className="mt-1 text-xs">
                      {muafiyet.description}{' '}
                      <a href={muafiyet.url} target="_blank" rel="noreferrer">
                        {muafiyet.system}
                      </a>
                    </p>
                  )}
                </Alert>
              )}

              {active && (
                <div className="flex flex-wrap items-center gap-4">
                  {dersKaydi && (
                    <a href={dersKaydi.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm">
                      Ders kaydı {dersKaydi.system}'te yapılır <ExtIcon aria-hidden className="size-3.5" />
                    </a>
                  )}
                </div>
              )}
              {active && <Withdraw e={e} />}
            </Card>
          );
        })}
      </Page>
    </>
  );
}
