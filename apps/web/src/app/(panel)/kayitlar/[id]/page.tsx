import Link from 'next/link';
import { GRADES, LABELS, LEAVE_REASONS, PASSING_GRADES } from '@cap/contracts';
import { ActionForm, SubmitButton } from '@/components/forms';
import { ApprovalTable, EnrollmentBadge, FormBadge, RuleList } from '@/components/status';
import { Alert, Badge, buttonVariants, Card, CardTitle, Empty, Field, Input, Page, PageHero, Progress, Select, Stat, Table, Td, Th } from '@/components/ui';
import { api } from '@/lib/api';
import { fmtDate, fmtDateTime, fmtGpa, termLabel } from '@/lib/format';
import {
  advisorAction,
  completeAction,
  createProtocolAction,
  exemptionAction,
  gradesAction,
  leaveAction,
  saveCourseRegAction,
  submitCourseRegAction,
  submitProtocolAction,
  termRecordAction,
  verifyTermRecordAction,
  withdrawEnrollmentAction,
} from '@/lib/actions';
import type { EnrollmentDetail } from '@/lib/types';

export const metadata = { title: 'Kayıt' };

const itemTone = { PENDING: 'muted', PASSED: 'ok', FAILED: 'bad', EXEMPT: 'neutral' } as const;

/** Bir öğrencinin ÇAP / yan dal kaydı: öğrenci, komisyon ve ana dal imzacılarının ortak ekranı. */
export default async function EnrollmentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ kayit?: string }> }) {
  const [{ id }, { kayit }] = await Promise.all([params, searchParams]);
  const d = await api<EnrollmentDetail>(`/enrollments/${id}`);
  const { enrollment: e, student, protocol, can, viewer } = d;
  const track = LABELS.track[e.type];
  const term = d.currentTerm;
  const currentReg = d.courseRegistrations.find((r) => r.termId === term?.id);
  const editableReg = can.courseRegistration && term;
  const chosen = new Map(currentReg?.items.map((i) => [i.protocolCourseId, i.code]) ?? []);
  const startIndex = d.terms.findIndex((t) => t.id === e.startTermId);
  const started = d.terms.filter((t, i) => new Date(t.startsAt) <= new Date() && i >= startIndex);
  const protocolEcts = protocol?.courses.reduce((t, c) => t + c.ects, 0) ?? 0;
  const gradable = d.courseRegistrations.filter((r) => r.status === 'APPROVED');

  return (
    <>
      <PageHero
        title={`${student.fullName} · ${track}`}
        crumbs={[viewer.owner ? 'Kayıtlarım' : 'Öğrenciler', student.studentNo]}
        subtitle={
          <>
            Ana dal: {student.mainProgram} ({student.mainFaculty}) · {track}: {e.program.name} · başlangıç {termLabel(e.offering.term)}
          </>
        }
        actions={<EnrollmentBadge value={e.status} />}
      />
      <Page>
        {kayit && <Alert tone="ok" title="Kesin kaydınız yapıldı.">Komisyon Kabul ve Ders Protokolünüzü hazırlayıp imzaya gönderecek; imzanız istendiğinde “İmzalarım” sayfasında görünür.</Alert>}
        {d.withdrawals[0] && (
          <Alert tone="info" title={`Programdan ayrıldı (${fmtDate(d.withdrawals[0].createdAt)})`}>
            {d.withdrawals[0].reason}
            {d.withdrawals[0].capToMinorOutcome?.message && <span className="mt-1 block">{d.withdrawals[0].capToMinorOutcome.message}</span>}
          </Alert>
        )}

        {d.progress && (
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-su-border/70 bg-white p-4 sm:col-span-2">
              <Progress value={d.progress.trackEcts} max={d.progress.requiredEcts} label="Protokol AKTS (geçilen + muaf)" />
              {d.progress.graduation && <p className="mt-2 text-xs text-su-muted">{d.progress.graduation.message}</p>}
            </div>
            <Stat label={`${track} ortalaması`} value={fmtGpa(d.progress.trackGpa)} hint="Girilen notlardan" />
            <Stat label="Ana dal GNO" value={fmtGpa(d.progress.mainGano)} hint={e.ganoStrikes ? `GNO düşüşü: ${e.ganoStrikes}` : 'Son dönem beyanı'} />
          </div>
        )}

        {/* ---------------- Kabul ve Ders Protokolü ---------------- */}
        <Card>
          <CardTitle
            aside={
              <div className="flex flex-wrap items-center gap-2">
                <FormBadge value={protocol?.status ?? null} />
                {protocol && (
                  <Link href={`/yazdir/protokol/${e.id}`} className={buttonVariants({ size: 'sm', variant: 'outline' })}>
                    Yazdır
                  </Link>
                )}
              </div>
            }
          >
            Kabul ve Ders Protokolü
            {protocol && <span className="block text-xs font-normal text-su-muted">Şablon: {protocol.template.title}</span>}
          </CardTitle>

          {!protocol && !d.template && (
            <Alert tone="warn" title={`${student.mainProgram} için ${track.toLowerCase()} protokol şablonu tanımlı değil.`}>
              {viewer.coordinator ? <Link href="/koordinator/protokoller">Protokol şablonları</Link> : 'Komisyon şablonu tanımladığında protokolünüz hazırlanacak.'}
            </Alert>
          )}
          {!protocol && d.template && !can.createProtocol && <Empty>Protokol komisyon tarafından henüz hazırlanmadı.</Empty>}

          {protocol && (
            <>
              <Table>
                <thead>
                  <tr>
                    <Th>Ders kodu</Th>
                    <Th>Ders adı</Th>
                    <Th>AKTS</Th>
                    <Th>Yarıyıl</Th>
                    <Th>Durum</Th>
                  </tr>
                </thead>
                <tbody>
                  {protocol.courses.map((c) => (
                    <tr key={c.id}>
                      <Td className="font-mono text-xs">{c.code ?? c.fulfilledCode ?? '—'}</Td>
                      <Td>
                        {c.name}
                        {c.fulfilledName && <span className="block text-xs text-su-muted">→ {c.fulfilledName}</span>}
                      </Td>
                      <Td>{c.ects}</Td>
                      <Td>{c.semester}</Td>
                      <Td>
                        <Badge tone={itemTone[c.status]}>
                          {LABELS.itemStatus[c.status]}
                          {c.grade ? ` · ${c.grade}` : ''}
                        </Badge>
                      </Td>
                    </tr>
                  ))}
                  <tr>
                    <Td colSpan={2} className="text-right font-semibold">
                      Toplam
                    </Td>
                    <Td className="font-semibold">{protocolEcts}</Td>
                    <Td colSpan={2} className="text-xs text-su-muted">
                      {protocol.commonEcts > 0 && `+ ${protocol.commonEcts} AKTS ana dalda alınan ortak dersler = ${protocolEcts + protocol.commonEcts}`}
                    </Td>
                  </tr>
                </tbody>
              </Table>
              {protocol.results.length > 0 && (
                <div className="mt-3">
                  <RuleList results={protocol.results} />
                </div>
              )}
              <div className="mt-4">
                <ApprovalTable approvals={protocol.approvals} />
              </div>
              {can.submitProtocol && (
                <ActionForm action={submitProtocolAction} className="mt-4">
                  <input type="hidden" name="enrollmentId" value={e.id} />
                  <SubmitButton confirm="Protokol beş imzacıya gönderilecek. Devam edilsin mi?">İmzaya gönder</SubmitButton>
                </ActionForm>
              )}
            </>
          )}

          {can.createProtocol && d.template && (
            <ActionForm action={createProtocolAction} className="mt-4 rounded-lg bg-su-bg p-3">
              <input type="hidden" name="enrollmentId" value={e.id} />
              {e.type === 'YANDAL' ? (
                <fieldset>
                  <legend className="text-sm font-medium text-su-heading">Yan dal planı: havuzdan en az 30 AKTS ve 6 ders seçin (Yan Dal Yön. m.5/1-g)</legend>
                  <div className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                    {d.template.items.map((i) => (
                      <label key={i.id} className="flex items-center gap-2">
                        <input type="checkbox" name="item" value={i.id} defaultChecked={protocol?.courses.some((c) => c.code === i.code)} />
                        <span className="font-mono text-xs">{i.code}</span> {i.name} <span className="text-xs text-su-subtle">{i.ects} AKTS</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              ) : (
                <p className="text-sm text-su-muted">
                  “{d.template.title}” protokolünden üretilir: {d.template.items.length} satır, {d.template.ects} AKTS + {d.template.commonEcts} ortak AKTS.
                </p>
              )}
              <SubmitButton size="sm" variant={protocol ? 'outline' : 'primary'}>
                {protocol ? 'Şablondan yeniden üret' : 'Protokolü şablondan üret'}
              </SubmitButton>
            </ActionForm>
          )}
        </Card>

        {/* ---------------- Ders kayıt formu (FORM01) ---------------- */}
        {protocol?.status === 'APPROVED' && (
          <Card>
            <CardTitle aside={currentReg && <FormBadge value={currentReg.status} />}>
              Ders kayıt formu
              <span className="block text-xs font-normal text-su-muted">
                {term ? termLabel(term) : ''} · öğrenci hazırlar; öğrenci, ana dal danışmanı ve koordinatör imzalar (FORM01)
              </span>
            </CardTitle>
            {editableReg ? (
              <>
                <ActionForm action={saveCourseRegAction}>
                  <input type="hidden" name="enrollmentId" value={e.id} />
                  <input type="hidden" name="termId" value={term.id} />
                  <fieldset>
                    <legend className="text-sm font-medium text-su-heading">Bu dönem alınacak dersler</legend>
                    <div className="mt-2 grid gap-x-6 gap-y-1.5 text-sm lg:grid-cols-2">
                      {d.registrationOptions
                        .filter((o) => o.kind === 'COURSE')
                        .map((o) => (
                          <label key={o.protocolCourseId} className="flex items-center gap-2">
                            <input type="checkbox" name="item" value={o.protocolCourseId} defaultChecked={chosen.has(o.protocolCourseId)} />
                            <span className="font-mono text-xs">{o.code}</span> {o.name}
                            <span className="text-xs text-su-subtle">
                              {o.ects} AKTS · {o.semester}. yy{o.status === 'FAILED' ? ' · tekrar' : ''}
                            </span>
                          </label>
                        ))}
                    </div>
                  </fieldset>
                  {d.registrationOptions.some((o) => o.kind === 'ELECTIVE_SLOT') && (
                    <fieldset>
                      <legend className="text-sm font-medium text-su-heading">Teknik seçmeli ders yerleri</legend>
                      <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {d.registrationOptions
                          .filter((o) => o.kind === 'ELECTIVE_SLOT')
                          .map((o, i) => (
                            <Field key={o.protocolCourseId} label={`${o.name} (${i + 1})`}>
                              <Select name={`slot:${o.protocolCourseId}`} defaultValue={chosen.get(o.protocolCourseId) ?? ''}>
                                <option value="">— bu dönem alınmayacak —</option>
                                {o.choices.map((c) => (
                                  <option key={c.code} value={c.code}>
                                    {c.code} {c.name} ({c.ects})
                                  </option>
                                ))}
                              </Select>
                            </Field>
                          ))}
                      </div>
                    </fieldset>
                  )}
                  <SubmitButton size="sm" variant="outline">
                    Formu kaydet
                  </SubmitButton>
                </ActionForm>
                {currentReg && currentReg.items.length > 0 && (
                  <ActionForm action={submitCourseRegAction} className="mt-3 border-t border-su-border/60 pt-3">
                    <input type="hidden" name="enrollmentId" value={e.id} />
                    <input type="hidden" name="termId" value={term.id} />
                    <p className="text-sm text-su-muted">
                      Formda {currentReg.items.length} ders, {currentReg.items.reduce((t, i) => t + i.ects, 0)} AKTS var.
                    </p>
                    <SubmitButton confirm="Form imzaya gönderilecek ve sonra değiştirilemeyecek. Devam edilsin mi?">İmzaya gönder</SubmitButton>
                  </ActionForm>
                )}
              </>
            ) : (
              !currentReg && <Empty>Bu dönem için ders kayıt formu hazırlanmadı.</Empty>
            )}

            {d.courseRegistrations.map((r) => (
              <details key={r.id} open={r.termId === term?.id} className="mt-4 rounded-lg border border-su-border/60 p-3">
                <summary className="flex flex-wrap items-center gap-2 text-sm font-medium text-su-heading">
                  {termLabel(r.term)} <FormBadge value={r.status} />
                  <span className="text-xs font-normal text-su-muted">
                    {r.items.length} ders · {r.items.reduce((t, i) => t + i.ects, 0)} AKTS
                  </span>
                  <Link href={`/yazdir/ders-kayit/${e.id}?donem=${r.termId}`} className="ml-auto text-xs font-normal">
                    Yazdır
                  </Link>
                </summary>
                <ul className="mt-2 space-y-0.5 text-sm">
                  {r.items.map((i) => (
                    <li key={i.id}>
                      <span className="font-mono text-xs">{i.code}</span> {i.name} <span className="text-xs text-su-subtle">{i.ects} AKTS</span>
                      {i.protocolCourse.grade && <Badge tone={itemTone[i.protocolCourse.status]} className="ml-2">{i.protocolCourse.grade}</Badge>}
                    </li>
                  ))}
                </ul>
                <div className="mt-3">
                  <ApprovalTable approvals={r.approvals} />
                </div>
              </details>
            ))}
          </Card>
        )}

        {/* ---------------- Not girişi ---------------- */}
        {can.grades && gradable.length > 0 && (
          <Card>
            <CardTitle>
              Dönem sonu not girişi
              <span className="block text-xs font-normal text-su-muted">OBİS bağlantısı olmadığı için notları komisyon girer. DC şartlı geçer: başarılı sayılıyorsa işaretleyin (Yönetmelik m.13).</span>
            </CardTitle>
            <ActionForm action={gradesAction}>
              <input type="hidden" name="enrollmentId" value={e.id} />
              <Table>
                <thead>
                  <tr>
                    <Th>Dönem</Th>
                    <Th>Ders</Th>
                    <Th>Not</Th>
                    <Th>DC başarılı</Th>
                  </tr>
                </thead>
                <tbody>
                  {gradable.flatMap((r) =>
                    r.items
                      .filter((i) => i.protocolCourse.status !== 'EXEMPT')
                      .map((i) => (
                        <tr key={i.id}>
                          <Td className="text-xs">{termLabel(r.term)}</Td>
                          <Td>
                            <span className="font-mono text-xs">{i.code}</span> {i.name}
                          </Td>
                          <Td>
                            <Select name={`grade:${i.id}`} defaultValue={i.protocolCourse.grade ?? ''} aria-label={`${i.name} notu`} className="w-28">
                              <option value="">—</option>
                              {GRADES.map((g) => (
                                <option key={g} value={g}>
                                  {g}
                                </option>
                              ))}
                            </Select>
                          </Td>
                          <Td>
                            <input type="checkbox" name={`passed:${i.id}`} aria-label={`${i.name}: DC başarılı sayılır`} defaultChecked={i.protocolCourse.grade === 'DC' && i.protocolCourse.status === 'PASSED'} />
                          </Td>
                        </tr>
                      )),
                  )}
                </tbody>
              </Table>
              <SubmitButton size="sm">Notları kaydet</SubmitButton>
            </ActionForm>
          </Card>
        )}

        {/* ---------------- Özel şartlı derslerin muafiyeti ---------------- */}
        {protocol && d.exemptions.length > 0 && (
          <Card>
            <CardTitle>
              Özel şartlı derslerin muafiyeti
              <span className="block text-xs font-normal text-su-muted">
                Protokolün altındaki numaralı şartlardan birini sağlayan öğrenci, mezuniyetten önce muafiyet formuyla başvurur; ana dal danışmanı ve koordinatör imzalar (Rehber).
              </span>
            </CardTitle>
            <ul className="space-y-3">
              {d.exemptions.map((x) => (
                <li key={x.id} className="rounded-lg border border-su-border/60 p-3 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p>
                      <span className="font-semibold">{x.no}.</span> {student.mainProgram} bölümünden <span className="font-mono text-xs">{x.sourceCourseCode}</span> {x.sourceCourseName} dersini alan öğrenci{' '}
                      <span className="font-mono text-xs">{x.targetCourseCode}</span> {x.targetCourseName} dersinden muaf sayılır.
                      {x.note && <span className="block text-xs text-su-muted">({x.note})</span>}
                    </p>
                    {x.request ? <FormBadge value={x.request.status} /> : !x.targetLabel && <Badge tone="muted">Karşılığı kalmadı</Badge>}
                  </div>
                  {x.request && (
                    <div className="mt-2 space-y-2">
                      <p className="text-xs text-su-muted">
                        Beyan: {x.request.sourceTerm} döneminde {x.request.sourceGrade} · {x.request.round}. tur ·{' '}
                        <Link href={`/yazdir/muafiyet/${e.id}?sart=${x.id}`}>Formu yazdır</Link>
                      </p>
                      <ApprovalTable approvals={x.approvals} />
                    </div>
                  )}
                  {can.exemption && x.available && (
                    <ActionForm action={exemptionAction} className="mt-3 flex flex-wrap items-end gap-3 rounded-lg bg-su-bg p-3">
                      <input type="hidden" name="enrollmentId" value={e.id} />
                      <input type="hidden" name="conditionId" value={x.id} />
                      <p className="w-full text-xs text-su-muted">Muaf sayılacak satır: {x.targetLabel}</p>
                      <Field label="Ana daldaki not">
                        <Select name="sourceGrade" className="w-28" aria-label={`Şart ${x.no}: ana daldaki not`}>
                          {GRADES.filter((g) => PASSING_GRADES.includes(g) && g !== 'G').map((g) => (
                            <option key={g} value={g}>
                              {g}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Field label="Dersi aldığı dönem">
                        <Input name="sourceTerm" required placeholder="2025-2026 Bahar" className="w-48" aria-label={`Şart ${x.no}: dersi aldığı dönem`} />
                      </Field>
                      <SubmitButton size="sm">{x.request ? 'Yeniden başvur' : 'Muafiyet başvurusu yap'}</SubmitButton>
                    </ActionForm>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        )}

        {/* ---------------- Dönem sonu beyanı ---------------- */}
        <Card>
          <CardTitle>
            Dönem sonu beyanı
            <span className="block text-xs font-normal text-su-muted">
              Her dönem sonunda ana dal genel not ortalaması girilir; komisyon transkriptle doğrular. Dönem sonu taraması bu beyanla çalışır (ÇAP Yön. m.9/1-e).
            </span>
          </CardTitle>
          {d.termRecords.length === 0 ? (
            <Empty>Henüz dönem beyanı yok.</Empty>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Dönem</Th>
                  <Th>Ana dal GNO</Th>
                  <Th>Ana dalda kayıt</Th>
                  <Th>Beyan eden</Th>
                  <Th>Doğrulama</Th>
                </tr>
              </thead>
              <tbody>
                {d.termRecords.map((r) => (
                  <tr key={r.id}>
                    <Td>{termLabel(r.term)}</Td>
                    <Td className="font-semibold">{fmtGpa(r.mainGano)}</Td>
                    <Td>{r.mainFrozen ? 'Dondurulmuş' : 'Etkin'}</Td>
                    <Td className="text-xs">
                      {r.declaredBy} · {fmtDateTime(r.declaredAt)}
                    </Td>
                    <Td>
                      {r.verifiedAt ? (
                        <Badge tone="ok">Doğrulandı · {r.verifiedBy}</Badge>
                      ) : can.verifyTermRecord ? (
                        <ActionForm action={verifyTermRecordAction} className="space-y-0">
                          <input type="hidden" name="id" value={r.id} />
                          <SubmitButton size="sm" variant="outline">
                            Transkriptle doğrula
                          </SubmitButton>
                        </ActionForm>
                      ) : (
                        <Badge tone="warn">Doğrulama bekliyor</Badge>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
          {can.termRecord && (
            <ActionForm action={termRecordAction} className="mt-4 flex flex-wrap items-end gap-3 rounded-lg bg-su-bg p-3">
              <input type="hidden" name="enrollmentId" value={e.id} />
              <Field label="Dönem">
                <Select name="termId" defaultValue={started.at(-1)?.id} className="w-48">
                  {started.map((t) => (
                    <option key={t.id} value={t.id}>
                      {termLabel(t)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Ana dal GNO">
                <Input name="mainGano" required inputMode="decimal" pattern="[0-4]([.,][0-9]{1,2})?" className="w-28" />
              </Field>
              <label className="flex items-center gap-2 pb-2 text-sm">
                <input type="checkbox" name="mainFrozen" /> Ana dalda kaydım donduruldu
              </label>
              <SubmitButton size="sm">Beyanı kaydet</SubmitButton>
            </ActionForm>
          )}
        </Card>

        {/* ---------------- Uyarılar ve izinler ---------------- */}
        {(d.findings.length > 0 || d.leaves.length > 0 || can.leave) && (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardTitle>Tarama bulguları</CardTitle>
              {d.findings.length === 0 ? (
                <Empty>Bulgu yok.</Empty>
              ) : (
                <ul className="space-y-2 text-sm">
                  {d.findings.map((f) => (
                    <li key={f.id} className="rounded-lg border border-su-border/60 p-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={f.status === 'FAIL' ? 'bad' : 'warn'}>{f.status === 'FAIL' ? 'Kayıt silme adayı' : 'Uyarı'}</Badge>
                        <span className="text-xs text-su-muted">
                          {termLabel(f.scan.term)} · {LABELS.finding[f.decision]}
                        </span>
                      </div>
                      <p className="mt-1">
                        <span className="font-medium">{f.result.title}:</span> {f.result.message} <span className="text-xs text-su-subtle">({f.result.article})</span>
                      </p>
                      {f.reason && <p className="text-xs text-su-muted">Karar: {f.reason}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card>
              <CardTitle>Dönem izinleri</CardTitle>
              {d.leaves.length === 0 ? (
                <Empty>İzin kaydı yok.</Empty>
              ) : (
                <ul className="space-y-1 text-sm">
                  {d.leaves.map((l) => (
                    <li key={l.id}>
                      {termLabel(l.term)} · {LABELS.leave[l.reason]} {l.note && <span className="text-xs text-su-muted">({l.note})</span>}
                    </li>
                  ))}
                </ul>
              )}
              {can.leave && (
                <ActionForm action={leaveAction} className="mt-4 rounded-lg bg-su-bg p-3">
                  <input type="hidden" name="enrollmentId" value={e.id} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Dönem">
                      <Select name="termId" defaultValue={term?.id}>
                        {d.terms.map((t) => (
                          <option key={t.id} value={t.id}>
                            {termLabel(t)}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Gerekçe">
                      <Select name="reason">
                        {LEAVE_REASONS.map((r) => (
                          <option key={r} value={r}>
                            {LABELS.leave[r]}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </div>
                  <Field label="Not">
                    <Input name="note" />
                  </Field>
                  <SubmitButton size="sm" variant="outline">
                    İzni kaydet
                  </SubmitButton>
                </ActionForm>
              )}
            </Card>
          </div>
        )}

        {/* ---------------- Komisyon işlemleri ve ayrılma ---------------- */}
        {(can.setAdvisor || can.complete || can.withdraw) && (
          <Card>
            <CardTitle>{viewer.coordinator ? 'Komisyon işlemleri' : 'Programdan ayrılma'}</CardTitle>
            <div className="grid gap-6 lg:grid-cols-3">
              {can.setAdvisor && (
                <ActionForm action={advisorAction}>
                  <input type="hidden" name="enrollmentId" value={e.id} />
                  <Field label="Ana dal danışmanı" hint="Formlarda imzalayacak hesap; hesabı yoksa ıslak imzayı siz işlersiniz">
                    <Select name="username" defaultValue={e.mainAdvisorUsername ?? ''}>
                      <option value="">— hesabı yok —</option>
                      {d.advisors.map((a) => (
                        <option key={a.username} value={a.username}>
                          {a.displayName}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <SubmitButton size="sm" variant="outline">
                    Danışmanı kaydet
                  </SubmitButton>
                </ActionForm>
              )}
              {can.complete && (
                <ActionForm action={completeAction}>
                  <input type="hidden" name="enrollmentId" value={e.id} />
                  <Field label="Mezuniyet denetimi" hint="Ana daldan mezuniyet GNO’su girilir; koşullar sağlanıyorsa kayıt tamamlanır">
                    <Input name="mainGano" required inputMode="decimal" placeholder="Ana dal mezuniyet GNO" />
                  </Field>
                  <SubmitButton size="sm" variant="outline" confirm="Mezuniyet koşulları denetlenecek; sağlanıyorsa kayıt tamamlanacak. Devam edilsin mi?">
                    Denetle ve tamamla
                  </SubmitButton>
                </ActionForm>
              )}
              {can.withdraw && (
                <ActionForm action={withdrawEnrollmentAction}>
                  <input type="hidden" name="enrollmentId" value={e.id} />
                  <Field label="Programdan ayrılma" hint="Öğrenci kendi isteğiyle ayrılabilir (ÇAP Yön. m.9/1-a)">
                    <Input name="reason" required minLength={5} placeholder="Gerekçe" />
                  </Field>
                  <SubmitButton size="sm" variant="danger" confirm="Programdan ayrılma işlenecek; geri alınamaz. Devam edilsin mi?">
                    Programdan ayrıl
                  </SubmitButton>
                </ActionForm>
              )}
            </div>
          </Card>
        )}
      </Page>
    </>
  );
}
