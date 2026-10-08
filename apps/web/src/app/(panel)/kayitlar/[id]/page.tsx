import Link from 'next/link';
import { Printer } from 'lucide-react';
import { LABELS, LEAVE_REASONS, REGISTRATION_DOCUMENTS } from '@cap/contracts';
import { ActionForm, SubmitButton } from '@/components/forms';
import { ApprovalTable, EnrollmentBadge, FormBadge, RuleList } from '@/components/status';
import { Alert, Badge, buttonVariants, Card, CardTitle, Empty, Field, Input, Page, PageHero, Progress, Select, Textarea } from '@/components/ui';
import { api } from '@/lib/api';
import { fmtDate, fmtDateTime, fmtGpa, termLabel } from '@/lib/format';
import {
  fileProtocolAction,
  leaveAction,
  saveCourseRegAction,
  saveProtocolAction,
  submitCourseRegAction,
  submitProtocolAction,
  trackAdvisorAction,
  withdrawEnrollmentAction,
} from '@/lib/panel-actions';
import type { EnrollmentDetail } from '@/lib/types';

export const metadata = { title: 'Kayıt' };

function ProtocolSection({ d }: { d: EnrollmentDetail }) {
  const p = d.protocol;
  const editable = d.can.editProtocol && (!p || ['DRAFT', 'REJECTED', 'APPROVED', 'FILED'].includes(p.status));
  const revision = !!p && ['APPROVED', 'FILED'].includes(p.status);
  const chosen = new Set(p?.courses.map((c) => c.code) ?? []);
  const isCap = d.enrollment.type === 'CAP';
  // ÇAP'ta ilk taslakta ana dalda olmayan tüm alan dersleri önerilir; yan dalda seçim boş başlar.
  const preselect = !p && isCap;
  const bySemester = new Map<string, typeof d.protocolOptions.courses>();
  for (const c of d.protocolOptions.courses) {
    const key = c.semester ? `${c.semester}. yarıyıl` : 'Ders havuzu';
    bySemester.set(key, [...(bySemester.get(key) ?? []), c]);
  }
  const total = (p?.courses.reduce((t, c) => t + c.ects, 0) ?? 0) + (p?.commonEcts ?? 0);

  return (
    <Card>
      <CardTitle
        aside={
          <div className="flex items-center gap-2">
            <FormBadge value={p?.status ?? null} />
            {p && (
              <Link href={`/yazdir/protokol/${d.enrollment.id}`} className={buttonVariants({ size: 'sm', variant: 'outline' })}>
                <Printer aria-hidden className="size-3.5" /> Yazdır
              </Link>
            )}
          </div>
        }
      >
        Kabul ve Ders Protokolü
        <span className="block text-xs font-normal text-su-muted">
          ÇAP Uygulama Esasları m.3 · {isCap ? 'ana dal ortak dersleri dahil lisansta 240, ön lisansta 120 AKTS (Yönerge m.7/2)' : 'en az 30 AKTS ve 6 ders (Yan Dal Yön. m.5/1-g)'}
          {p && ` · ${p.round}. tur · toplam ${total} AKTS`}
        </span>
      </CardTitle>

      {isCap && d.protocolOptions.commonCourses.length > 0 && (
        <p className="mb-3 rounded-lg bg-su-bg p-3 text-xs text-su-muted">
          Ortak sayılan ana dal dersleri ({d.protocolOptions.commonEcts} AKTS, Yönerge m.7/2):{' '}
          {d.protocolOptions.commonCourses.map((c) => `${c.code} ${c.name}`).join(', ')}
        </p>
      )}

      {p?.results && p.results.length > 0 && (
        <div className="mb-3">
          <RuleList results={p.results} />
        </div>
      )}

      {editable ? (
        <ActionForm action={saveProtocolAction}>
          <input type="hidden" name="enrollmentId" value={d.enrollment.id} />
          {[...bySemester.entries()].map(([sem, list]) => (
            <fieldset key={sem} className="rounded-xl border border-su-border/70 p-3">
              <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-su-muted">{sem}</legend>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {list.map((c) => (
                  <label key={c.code} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="course"
                      value={c.code}
                      defaultChecked={preselect ? !c.inMain : chosen.has(c.code)}
                      className="size-4 accent-[var(--color-su-primary)]"
                    />
                    <span className="font-mono text-xs text-su-subtle">{c.code}</span>
                    <span className="flex-1">{c.name}</span>
                    <span className="text-xs text-su-muted">{c.ects}</span>
                    {c.inMain && <Badge tone="warn">ana dalda var</Badge>}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
          {revision && (
            <Field label="Değişiklik gerekçesi" hint="Onaylanmış protokolde değişiklik tüm imzaları yeniden ister (Esaslar m.3).">
              <Input name="reason" required minLength={5} placeholder="Örn. dersin programdan kaldırılması" />
            </Field>
          )}
          <SubmitButton size="sm" variant={revision ? 'outline' : 'primary'} confirm={revision ? 'Onaylanmış protokol taslağa dönecek ve tüm imzalar yeniden istenecek. Devam edilsin mi?' : undefined}>
            {revision ? 'Değişiklik taslağı oluştur' : 'Taslağı kaydet ve denetle'}
          </SubmitButton>
        </ActionForm>
      ) : p ? (
        <ul className="grid gap-1 text-sm sm:grid-cols-2">
          {p.courses.map((c) => (
            <li key={c.code}>
              <span className="font-mono text-xs text-su-subtle">{c.code}</span> {c.name} <span className="text-xs text-su-muted">({c.ects})</span>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>Protokol henüz hazırlanmadı. Koordinatör hazırlar.</Empty>
      )}

      {d.can.editProtocol && p && ['DRAFT', 'REJECTED'].includes(p.status) && (
        <ActionForm action={submitProtocolAction} className="mt-3">
          <input type="hidden" name="enrollmentId" value={d.enrollment.id} />
          <SubmitButton size="sm" variant="accent">
            İmzacılara gönder
          </SubmitButton>
        </ActionForm>
      )}

      {p && p.approvals.length > 0 && (
        <div className="mt-4">
          <ApprovalTable approvals={p.approvals} />
        </div>
      )}

      {d.can.fileProtocol && (
        <ActionForm action={fileProtocolAction} className="mt-3">
          <input type="hidden" name="enrollmentId" value={d.enrollment.id} />
          <SubmitButton size="sm">Aslı öğrenci dosyasına kaldırıldı</SubmitButton>
        </ActionForm>
      )}
      {p?.filedAt && (
        <p className="mt-2 text-xs text-su-muted">
          Aslı dosyada: {p.filedBy} · {fmtDateTime(p.filedAt)}
        </p>
      )}
    </Card>
  );
}

function CourseRegSection({ d }: { d: EnrollmentDetail }) {
  const term = d.currentTerm;
  const reg = d.courseRegistrations.find((r) => r.termId === term?.id);
  const passed = new Set(d.progress?.courses.filter((c) => c.passed).map((c) => c.code) ?? []);
  const allowed = d.protocol?.courses.filter((c) => !passed.has(c.code)) ?? [];
  const selected = new Set(reg?.items.map((i) => i.code) ?? []);
  const editable = d.can.courseRegistration && (!reg || ['DRAFT', 'REJECTED'].includes(reg.status));
  const leave = d.leaves.find((l) => l.termId === term?.id);

  return (
    <Card>
      <CardTitle aside={<FormBadge value={reg?.status ?? null} />}>
        Ders kayıt formu · {term ? termLabel(term) : ''}
        <span className="block text-xs font-normal text-su-muted">
          ÇAP Uygulama Esasları m.4 · son tarih {fmtDateTime(d.window?.courseRegistrationDeadline)} · her dönem yenilenir
        </span>
      </CardTitle>
      {leave && (
        <Alert tone="info" className="mb-3">
          Bu dönem için dönem izni kayıtlı: {LABELS.leave[leave.reason]}.
        </Alert>
      )}
      {!d.protocol || !['APPROVED', 'FILED'].includes(d.protocol.status) ? (
        <Empty>Ders kaydı için önce Kabul ve Ders Protokolünün onaylanması gerekir.</Empty>
      ) : editable && term ? (
        <>
          <ActionForm action={saveCourseRegAction}>
            <input type="hidden" name="enrollmentId" value={d.enrollment.id} />
            <input type="hidden" name="termId" value={term.id} />
            <p className="text-xs text-su-muted">Protokoldeki, henüz geçilmemiş dersler. Ana dal ders programıyla çakışma kontrolü öğrenci ve danışmanın sorumluluğundadır (Esaslar m.4).</p>
            <div className="grid max-h-80 gap-1.5 overflow-y-auto rounded-xl border border-su-border/70 p-3 sm:grid-cols-2">
              {allowed.map((c) => (
                <label key={c.code} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="course" value={c.code} defaultChecked={selected.has(c.code)} className="size-4 accent-[var(--color-su-primary)]" />
                  <span className="font-mono text-xs text-su-subtle">{c.code}</span>
                  <span className="flex-1">{c.name}</span>
                  <span className="text-xs text-su-muted">{c.ects}</span>
                </label>
              ))}
            </div>
            <SubmitButton size="sm">Formu kaydet</SubmitButton>
          </ActionForm>
          {reg && reg.items.length > 0 && (
            <ActionForm action={submitCourseRegAction} className="mt-3">
              <input type="hidden" name="enrollmentId" value={d.enrollment.id} />
              <input type="hidden" name="termId" value={term.id} />
              <SubmitButton size="sm" variant="accent">
                İmzacılara gönder ({reg.items.length} ders, {reg.items.reduce((t, i) => t + i.ects, 0)} AKTS)
              </SubmitButton>
            </ActionForm>
          )}
        </>
      ) : reg ? (
        <ul className="grid gap-1 text-sm sm:grid-cols-2">
          {reg.items.map((c) => (
            <li key={c.code}>
              <span className="font-mono text-xs text-su-subtle">{c.code}</span> {c.name}
            </li>
          ))}
        </ul>
      ) : (
        <Empty>Bu dönem için form yok.</Empty>
      )}
      {reg && reg.approvals.length > 0 && (
        <div className="mt-4">
          <ApprovalTable approvals={reg.approvals} />
        </div>
      )}
      {d.courseRegistrations.filter((r) => r.termId !== term?.id).length > 0 && (
        <details className="mt-3 text-sm">
          <summary className="text-su-primary">Önceki dönemler</summary>
          <ul className="mt-2 space-y-1">
            {d.courseRegistrations
              .filter((r) => r.termId !== term?.id)
              .map((r) => (
                <li key={r.id}>
                  {r.termId}: <FormBadge value={r.status} /> {r.items.length} ders
                </li>
              ))}
          </ul>
        </details>
      )}
    </Card>
  );
}

export default async function EnrollmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await api<EnrollmentDetail>(`/enrollments/${id}`);
  const e = d.enrollment;
  const outcome = d.withdrawals[0]?.capToMinorOutcome;
  const active = e.status === 'ACTIVE' || e.status === 'FROZEN';

  return (
    <>
      <PageHero
        title={`${d.student.fullName} · ${d.student.studentNo}`}
        crumbs={['Kayıtlı öğrenciler', LABELS.track[e.type]]}
        subtitle={`${e.program.name} (${e.program.unitName}) · ana dal: ${d.student.mainProgram ?? '—'}`}
        actions={<EnrollmentBadge value={e.status} />}
      />
      <Page className="max-w-7xl">
        <div className="grid gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            <ProtocolSection d={d} />
            <CourseRegSection d={d} />
          </div>
          <div className="space-y-6">
            <Card>
              <CardTitle>Kayıt</CardTitle>
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="text-su-muted">Kesin kayıt</dt>
                  <dd>
                    {fmtDate(e.createdAt)} · {e.registeredBy ?? 'önceki dönem'}
                  </dd>
                </div>
                <div>
                  <dt className="text-su-muted">Ana dal danışmanı · program danışmanı</dt>
                  <dd>
                    {d.student.advisorUsername} · {e.trackAdvisorUsername ?? '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-su-muted">Koordinatör</dt>
                  <dd>{e.coordinatorUsername}</dd>
                </div>
                {e.ganoStrikes > 0 && (
                  <div>
                    <dt className="text-su-muted">GNO düşüş sayacı (YÖK m.17/4)</dt>
                    <dd className="text-warn">{e.ganoStrikes}</dd>
                  </div>
                )}
                {e.registrationDocuments && (
                  <div>
                    <dt className="text-su-muted">Kayıt belgeleri</dt>
                    <dd className="text-xs">
                      {REGISTRATION_DOCUMENTS.filter((x) => e.registrationDocuments!.includes(x.key))
                        .map((x) => x.label)
                        .join(', ')}
                    </dd>
                  </div>
                )}
              </dl>
              {d.can.setTrackAdvisor && (
                <ActionForm action={trackAdvisorAction} className="mt-3 flex items-end gap-2">
                  <input type="hidden" name="enrollmentId" value={e.id} />
                  <div className="flex-1">
                    <Field label="Program danışmanı (Danışmanlık Yön. m.6/5)">
                      <Input name="username" defaultValue={e.trackAdvisorUsername ?? ''} required />
                    </Field>
                  </div>
                  <SubmitButton size="sm" variant="outline">
                    Ata
                  </SubmitButton>
                </ActionForm>
              )}
            </Card>

            {d.progress && (
              <Card>
                <CardTitle>İlerleme (OBİS)</CardTitle>
                <Progress value={d.progress.trackEcts} max={d.progress.requiredEcts} label="Tamamlanan AKTS" />
                <p className="mt-2 text-sm text-su-muted">
                  Ana dal GNO {fmtGpa(d.progress.mainGano)} · program ortalaması {fmtGpa(d.progress.trackGpa)} · {d.progress.semesterNo}. yarıyıl
                </p>
                {d.progress.graduation && (
                  <div className="mt-2">
                    <RuleList results={[d.progress.graduation]} />
                  </div>
                )}
              </Card>
            )}

            <Card>
              <CardTitle>Uyarılar ve tarama bulguları</CardTitle>
              {d.findings.length === 0 ? (
                <p className="text-sm text-su-muted">Bulgu yok.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {d.findings.map((f) => (
                    <li key={f.id}>
                      <Badge tone={f.status === 'FAIL' ? 'bad' : 'warn'}>{f.ruleCode}</Badge> {f.result.message}
                      <span className="block text-xs text-su-subtle">
                        {fmtDate(f.scan.createdAt)} · {LABELS.finding[f.decision]}
                        {f.reason && ` · ${f.reason}`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <CardTitle>Dönem izinleri</CardTitle>
              {d.leaves.length === 0 ? (
                <p className="text-sm text-su-muted">Kayıtlı izin yok.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {d.leaves.map((l) => (
                    <li key={l.id}>
                      {l.termId}: <b>{LABELS.leave[l.reason]}</b> {l.note && `· ${l.note}`}
                    </li>
                  ))}
                </ul>
              )}
              {d.can.leave && (
                <ActionForm action={leaveAction} className="mt-3">
                  <input type="hidden" name="enrollmentId" value={e.id} />
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Dönem">
                      <Select name="termId" defaultValue={d.currentTerm?.id}>
                        {d.terms.map((t) => (
                          <option key={t.id} value={t.id}>
                            {termLabel(t)}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Neden">
                      <Select name="reason">
                        {LEAVE_REASONS.map((r) => (
                          <option key={r} value={r}>
                            {LABELS.leave[r]}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </div>
                  <Field label="Açıklama (dilekçe no vb.)">
                    <Input name="note" />
                  </Field>
                  <SubmitButton size="sm" variant="outline">
                    İzni kaydet
                  </SubmitButton>
                </ActionForm>
              )}
            </Card>

            {outcome?.hasMinorProgram && (
              <Alert tone={outcome.eligibleForCertificate ? 'ok' : 'info'} title="Çift ana daldan ayrılma sonucu">
                <p>{outcome.message}</p>
                {outcome.passedPoolCourses && <p className="mt-1 text-xs">Yan dal havuzundan geçilen ({outcome.passedPoolEcts} AKTS): {outcome.passedPoolCourses.join(', ')}</p>}
              </Alert>
            )}

            {d.can.withdraw && active && (
              <details className="rounded-2xl border border-su-border/70 bg-white px-5 py-4">
                <summary className="text-sm font-medium text-bad">Öğrencinin ayrılma dilekçesini işle</summary>
                <ActionForm action={withdrawEnrollmentAction} className="mt-3">
                  <input type="hidden" name="enrollmentId" value={e.id} />
                  <Field label="Gerekçe (dilekçe evrak numarası)">
                    <Textarea name="reason" required minLength={5} />
                  </Field>
                  <SubmitButton variant="danger" size="sm" confirm="Öğrencinin kaydı 'kendi isteğiyle ayrıldı' olarak kapatılacak. Devam edilsin mi?">
                    Ayrılmayı işle
                  </SubmitButton>
                </ActionForm>
              </details>
            )}
          </div>
        </div>
      </Page>
    </>
  );
}
