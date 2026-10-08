import Link from 'next/link';
import { GRADES, LABELS } from '@cap/contracts';
import { ActionForm, SubmitButton } from '@/components/forms';
import { ReasonAction, ReviewButtons } from '@/components/inline';
import { CourseStateBadge, ReviewBadge } from '@/components/status';
import { Alert, Badge, Card, CardTitle, Empty, Field, Input, Select, Table, Td, Th } from '@/components/ui';
import { addAttemptAction, addPlanAction, backfillAction, cancelRecordAction, correctAttemptAction, courseRequestAction, planOpAction, reviewAction, templateAction } from '@/lib/actions';
import { termLabel } from '@/lib/format';
import type { Course, PlanItem, StudentCard } from '@/lib/types';

const resultLabel = (a: PlanItem['attempts'][number]) => (a.grade ? `${a.grade} · ${LABELS.attemptResult[a.result]}` : LABELS.attemptResult[a.result]);

/**
 * Ders takibi (sistemin merkezi): alınacak dersler, her dersin hangi dönem alındığı / geçildiği, notu ve
 * durumu; tekrarlar ayrı deneme olarak görünür. Onay bekleyen kayıt hesaba girmez.
 */
export function CoursesTab({ c, catalog }: { c: StudentCard; catalog: Course[] }) {
  const s = c.student;
  const coord = c.can.coordinator;
  const no = { studentNo: s.studentNo };
  const term = c.currentTerm;
  const live = (i: PlanItem) => i.status === 'APPROVED' && !i.removedAt;
  const takeable = c.planItems.filter((i) => live(i) && !['GECTI', 'MUAF'].includes(i.state) && !i.attempts.some((a) => a.status !== 'REJECTED' && a.status !== 'CANCELLED' && (a.termId === term?.id || a.result === 'TAKEN')));
  const electives = catalog.filter((x) => x.kind === 'TEKNIK_SECMELI');
  const inPlan = new Set(c.planItems.filter((i) => i.courseCode && i.state !== 'CIKARILDI').map((i) => i.courseCode));
  const semesters = [...new Set(c.planItems.map((i) => i.semester))].sort((a, b) => a - b);
  const template = c.templates.find((t) => t.sourceProgramId === s.mainProgramId) ?? c.templates[0];
  const conditions = template?.conditions ?? [];
  const pendingRequests = s.courseRequests.filter((r) => r.status === 'PENDING');

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ['Listedeki ders', `${c.totals.plannedCount} · ${c.totals.plannedEcts} AKTS`],
          ['Tamamlanan', `${c.totals.completedCount} · ${c.totals.completedEcts} AKTS`],
          ['Kalan', `${c.totals.remainingCount} · ${c.totals.remainingEcts} AKTS`],
          ['Onay bekleyen satır', String(c.totals.pendingItems)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl border border-su-border/70 bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-su-muted">{k}</p>
            <p className="mt-1 text-lg font-semibold text-su-primary">{v}</p>
          </div>
        ))}
      </div>

      {c.planItems.length === 0 && (
        <Alert tone="info" title="Ders listesi henüz yok.">
          {coord ? 'Şablondan (bölümün protokolü) oluşturabilir ya da tek tek ekleyebilirsiniz.' : 'Protokolünüzdeki dersleri aşağıdan katalogdan seçerek ekleyin; koordinatör onaylayınca kesinleşir.'}
        </Alert>
      )}

      <Card>
        <CardTitle aside={coord && <Link href={`/yazdir/protokol/${s.studentNo}`} className="text-sm">Protokol formunu yazdır</Link>}>
          Alınacak dersler
          <span className="block text-xs font-normal text-su-muted">Her satırda dersin denemeleri: alındığı dönem, notu ve sonucu. Çıkarılan ve reddedilen satırlar silinmez.</span>
        </CardTitle>
        {semesters.map((sem) => (
          <div key={sem} className="mb-5">
            <h3 className="mb-2 text-sm font-semibold text-su-heading">{sem}. yarıyıl</h3>
            <Table>
              <thead>
                <tr>
                  <Th>Ders</Th>
                  <Th>AKTS</Th>
                  <Th>Durum</Th>
                  <Th>Denemeler (dönem · not)</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {c.planItems
                  .filter((i) => i.semester === sem)
                  .map((i) => (
                    <tr key={i.id} className={i.state === 'CIKARILDI' ? 'opacity-60' : undefined}>
                      <Td>
                        <span className="font-mono text-xs">{i.courseCode ?? '—'}</span> {i.name}
                        {i.kind === 'ELECTIVE_SLOT' && <span className="block text-xs text-su-muted">Seçmeli ders yeri: alınan ders dönem kaydında seçilir</span>}
                        {i.status !== 'APPROVED' && (
                          <span className="mt-1 block">
                            <ReviewBadge value={i.status} /> <span className="text-xs text-su-muted">{LABELS.source[i.source]}{i.reviewNote && ` · ${i.reviewNote}`}</span>
                          </span>
                        )}
                        {i.addReason && i.source !== 'BACKFILL' && <span className="block text-[11px] text-su-subtle">Ekleme gerekçesi: {i.addReason}</span>}
                        {i.removedAt && <span className="block text-[11px] text-su-subtle">Çıkarıldı ({i.removedBy}): {i.removeReason}</span>}
                        {i.exemptAt && <span className="block text-[11px] text-su-subtle">Muafiyet{i.exemptCondNo ? ` (özel şart ${i.exemptCondNo})` : ''}: {i.exemptReason}</span>}
                      </Td>
                      <Td>{i.ects}</Td>
                      <Td>
                        <CourseStateBadge value={i.state} />
                      </Td>
                      <Td>
                        {i.attempts.length === 0 ? (
                          <span className="text-xs text-su-subtle">—</span>
                        ) : (
                          <ul className="space-y-1.5">
                            {i.attempts.map((a) => (
                              <li key={a.id} className={`text-xs ${a.status === 'CANCELLED' || a.status === 'REJECTED' ? 'line-through opacity-60' : ''}`}>
                                <span className="font-medium">{termLabel(a.term)}</span>
                                {i.kind === 'ELECTIVE_SLOT' && ` · ${a.courseCode} ${a.courseName}`} · {resultLabel(a)} {a.status !== 'APPROVED' && <ReviewBadge value={a.status} />}
                                {a.source === 'BACKFILL' && <Badge tone="muted">geriye dönük</Badge>}
                                {a.correctedAt && <Badge tone="muted">düzeltildi</Badge>}
                                {a.reviewNote && a.status !== 'APPROVED' && <span className="block text-su-subtle">{a.reviewNote}</span>}
                                <span className="mt-1 flex flex-wrap gap-2">
                                  {coord && a.status === 'PENDING' && <ReviewButtons action={reviewAction} kind="attempt" id={a.id} />}
                                  {coord && a.status === 'APPROVED' && (
                                    <ReasonAction action={correctAttemptAction} fields={{ ...no, id: a.id }} label="Düzelt" placeholder="Düzeltme gerekçesi">
                                      <Select name="termId" defaultValue={a.termId} aria-label="Dönem">
                                        {c.terms.map((x) => (
                                          <option key={x.id} value={x.id}>
                                            {termLabel(x)}
                                          </option>
                                        ))}
                                      </Select>
                                      <Select name="grade" defaultValue={a.grade ?? '-'} aria-label="Not">
                                        <option value="-">Not yok</option>
                                        {GRADES.map((g) => (
                                          <option key={g} value={g}>
                                            {g}
                                          </option>
                                        ))}
                                      </Select>
                                      <label className="flex items-center gap-1 text-xs">
                                        <input type="checkbox" name="passed" defaultChecked={a.result === 'PASSED'} /> DC başarılı sayılsın
                                      </label>
                                    </ReasonAction>
                                  )}
                                  {((coord && a.status !== 'CANCELLED') || (!coord && c.can.addAttempt && a.status === 'PENDING')) && (
                                    <ReasonAction action={cancelRecordAction} fields={{ ...no, kind: 'attempt', id: a.id }} label={coord ? 'İptal et' : 'Geri çek'} />
                                  )}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </Td>
                      <Td>
                        <div className="flex flex-col items-start gap-1.5">
                          {coord && i.status === 'PENDING' && <ReviewButtons action={reviewAction} kind="plan" id={i.id} />}
                          {!coord && c.can.editPlan && i.status === 'PENDING' && <ReasonAction action={planOpAction} fields={{ ...no, op: 'cancel', id: i.id }} label="Geri çek" />}
                          {coord && live(i) && i.state !== 'GECTI' && (
                            <ReasonAction action={planOpAction} fields={{ ...no, op: 'remove', id: i.id }} label="Listeden çıkar" placeholder="Gerekçe (ör. kurul kararı)" confirm="Ders listeden çıkarılacak (silinmez)." />
                          )}
                          {coord && live(i) && !i.exemptAt && i.state !== 'GECTI' && (
                            <ReasonAction action={planOpAction} fields={{ ...no, op: 'exempt', id: i.id }} label="Muaf say" placeholder="Gerekçe">
                              {conditions.length > 0 && (
                                <Select name="conditionNo" defaultValue="" aria-label="Özel şart">
                                  <option value="">Özel şart yok</option>
                                  {conditions.map((k) => (
                                    <option key={k.no} value={k.no}>
                                      {k.no}: {k.sourceCourseCode} → {k.targetCourseCode}
                                    </option>
                                  ))}
                                </Select>
                              )}
                            </ReasonAction>
                          )}
                          {coord && i.exemptAt && <ReasonAction action={planOpAction} fields={{ ...no, op: 'unexempt', id: i.id }} label="Muafiyeti kaldır" />}
                        </div>
                      </Td>
                    </tr>
                  ))}
              </tbody>
            </Table>
          </div>
        ))}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {c.can.addAttempt && term && (
          <Card>
            <CardTitle>
              {coord ? 'Dönem dersi gir' : 'Bu dönem aldığım ders'}
              <span className="block text-xs font-normal text-su-muted">
                {termLabel(term)} · {coord ? 'koordinatörün girdiği kayıt doğrudan onaylıdır' : 'koordinatör onaylayınca kesinleşir'}
              </span>
            </CardTitle>
            {takeable.length === 0 ? (
              <Empty>Bu dönem için girilebilecek ders yok (liste onaylı değil ya da dersler girildi).</Empty>
            ) : (
              <ActionForm action={addAttemptAction}>
                <input type="hidden" name="studentNo" value={s.studentNo} />
                <input type="hidden" name="termId" value={term.id} />
                <Field label="Ders">
                  <Select name="planItemId">
                    {takeable.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.courseCode ?? '—'} {i.name} ({i.ects} AKTS){i.state === 'KALDI' ? ' · tekrar' : ''}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Seçmeli ders yeri seçtiyseniz alınan ders" hint="Yalnızca o yarıyılın teknik seçmelileri">
                  <Select name="courseCode" defaultValue="">
                    <option value="">—</option>
                    {electives
                      .filter((x) => !inPlan.has(x.code))
                      .map((x) => (
                        <option key={x.code} value={x.code}>
                          {x.semester}. yy · {x.code} {x.name}
                        </option>
                      ))}
                  </Select>
                </Field>
                <SubmitButton size="sm">Dönem dersini gir</SubmitButton>
              </ActionForm>
            )}
            {!coord && (
              <p className="mt-3 text-xs text-su-muted">
                İmzalı ders kayıt formunuzu <Link href={`/ogrenciler/${s.studentNo}?sekme=belgeler`}>Belgeler</Link> sekmesinden yükleyin. <Link href={`/yazdir/ders-kayit/${s.studentNo}`}>Formu doldurulmuş olarak yazdır</Link>.
              </p>
            )}
          </Card>
        )}

        {c.can.editPlan && (
          <Card>
            <CardTitle>
              Listeye ders ekle
              <span className="block text-xs font-normal text-su-muted">Dersler katalogdan seçilir; serbest metinle ders girilemez.</span>
            </CardTitle>
            <ActionForm action={addPlanAction}>
              <input type="hidden" name="studentNo" value={s.studentNo} />
              <Field label="Ders (kod ya da ad yazıp seçin)">
                <Input name="courseCode" required list="katalog" autoComplete="off" placeholder="3301156" />
              </Field>
              <datalist id="katalog">
                {catalog
                  .filter((x) => !inPlan.has(x.code))
                  .map((x) => (
                    <option key={x.code} value={x.code}>
                      {x.name} · {x.ects} AKTS · {x.semester}. yy
                    </option>
                  ))}
              </datalist>
              <Field label={coord ? 'Gerekçe (zorunlu)' : 'Açıklama (isteğe bağlı)'}>
                <Input name="reason" required={coord} minLength={coord ? 5 : undefined} />
              </Field>
              <SubmitButton size="sm">Ekle</SubmitButton>
            </ActionForm>
            {coord && c.templates.length > 0 && (
              <ActionForm action={templateAction} className="mt-4 rounded-lg bg-su-bg p-3">
                <input type="hidden" name="studentNo" value={s.studentNo} />
                <Field label="Şablondan oluştur (bölümün protokolü)">
                  <Select name="templateId" defaultValue={template?.id}>
                    {c.templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Gerekçe">
                  <Input name="reason" required minLength={5} defaultValue="Kabul ve Ders Protokolü" />
                </Field>
                <SubmitButton size="sm" variant="outline">
                  Şablondaki eksik dersleri ekle
                </SubmitButton>
              </ActionForm>
            )}
          </Card>
        )}

        {coord && (
          <Card>
            <CardTitle>
              Geriye dönük giriş
              <span className="block text-xs font-normal text-su-muted">Sistem açılmadan önce alınan dersler: dönem ve notla birlikte doğrudan onaylı yazılır.</span>
            </CardTitle>
            <ActionForm action={backfillAction}>
              <input type="hidden" name="studentNo" value={s.studentNo} />
              <Field label="Ders">
                <Select name="planItemId">
                  {c.planItems
                    .filter((i) => live(i) && !['GECTI', 'MUAF'].includes(i.state))
                    .map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.courseCode ?? '—'} {i.name}
                      </option>
                    ))}
                </Select>
              </Field>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Dönem">
                  <Select name="termId">
                    {c.terms
                      .filter((x) => new Date(x.startsAt) <= new Date())
                      .map((x) => (
                        <option key={x.id} value={x.id}>
                          {termLabel(x)}
                        </option>
                      ))}
                  </Select>
                </Field>
                <Field label="Not">
                  <Select name="grade" defaultValue="">
                    <option value="">Not yok (alındı)</option>
                    {GRADES.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Seçmeli yer için ders">
                  <Select name="courseCode" defaultValue="">
                    <option value="">—</option>
                    {electives.map((x) => (
                      <option key={x.code} value={x.code}>
                        {x.code} {x.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="passed" /> DC notu başarılı sayılsın
              </label>
              <SubmitButton size="sm" variant="outline">
                Geçmiş kaydı gir
              </SubmitButton>
            </ActionForm>
          </Card>
        )}

        {c.can.requestCourse && (
          <Card>
            <CardTitle>
              Katalogda olmayan ders için talep
              <span className="block text-xs font-normal text-su-muted">Koordinatör dersi kataloğa ekleyip onaylarsa listenize işlenir.</span>
            </CardTitle>
            <ActionForm action={courseRequestAction}>
              <input type="hidden" name="studentNo" value={s.studentNo} />
              <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
                <Field label="Ders kodu">
                  <Input name="code" />
                </Field>
                <Field label="Ders adı">
                  <Input name="name" required minLength={3} />
                </Field>
              </div>
              <Field label="Neden gerekiyor">
                <Input name="note" required minLength={5} />
              </Field>
              <SubmitButton size="sm" variant="outline">
                Talep gönder
              </SubmitButton>
            </ActionForm>
          </Card>
        )}
      </div>

      {s.courseRequests.length > 0 && (
        <Card>
          <CardTitle>Ders talepleri {pendingRequests.length > 0 && <Badge tone="warn">{pendingRequests.length} bekliyor</Badge>}</CardTitle>
          <ul className="space-y-1 text-sm">
            {s.courseRequests.map((r) => (
              <li key={r.id}>
                {r.code} {r.name} · <ReviewBadge value={r.status} /> <span className="text-xs text-su-muted">{r.note}{r.reviewNote && ` · ${r.reviewNote}`}</span>
                {coord && r.status === 'PENDING' && (
                  <Link href="/katalog?sekme=talepler" className="ml-2 text-xs">
                    Katalogda sonuçlandır
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
