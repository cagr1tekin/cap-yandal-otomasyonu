import Link from 'next/link';
import { DECISION_TYPES, GANO_SOURCES, LABELS, LEAVE_REASONS, TRACK_TYPES } from '@cap/contracts';
import { ActionForm, SubmitButton } from '@/components/forms';
import { ReasonAction } from '@/components/inline';
import { RuleList, StudentStatusBadge, WorstBadge } from '@/components/status';
import { Alert, Badge, Card, CardTitle, Empty, Field, Input, Progress, Select, Stat, Table, Td, Th } from '@/components/ui';
import { cancelRecordAction, contactAction, decisionAction, ganoAction, inviteAction, leaveAction, updateStudentAction } from '@/lib/actions';
import { fmtDate, fmtDateTime, fmtGpa, termLabel } from '@/lib/format';
import type { StudentCard } from '@/lib/types';

/** Durum sekmesi: kimlik, ilerleme, kural sonuçları, GANO, izinler ve kararlar. */
export function SummaryTab({ c }: { c: StudentCard }) {
  const s = c.student;
  const coord = c.can.coordinator;
  const t = c.totals;
  const no = { studentNo: s.studentNo };
  const startedTerms = c.terms.filter((x) => new Date(x.startsAt) <= new Date());
  const trackGpa = c.live.inputs.trackGpa as number | null;
  const gano = s.ganoRecords.find((g) => !g.cancelledAt);
  const flagged = [...c.live.termEnd, ...c.live.plan].filter((r) => r.status === 'WARN' || r.status === 'FAIL');

  return (
    <>
      {c.live.graduationReady && (
        <Alert tone="ok" title={s.track === 'CAP' ? 'Çift ana dal diploması koşulları sağlanıyor.' : 'Yan dal sertifikası koşulları sağlanıyor.'}>
          {coord ? 'Karar sizde: aşağıdaki karar bölümünden işleyebilirsiniz.' : 'Kararı koordinatör verir.'}
        </Alert>
      )}
      {flagged.length > 0 && (
        <Alert tone={c.live.worst === 'FAIL' ? 'bad' : 'warn'} title="Yönerge uyarısı (karar değildir; kararı koordinatör verir)">
          <ul className="list-disc pl-4">
            {flagged.map((r) => (
              <li key={r.code}>
                {r.title}: {r.message} <span className="text-xs">({r.article})</span>
              </li>
            ))}
          </ul>
        </Alert>
      )}

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-su-border/70 bg-white p-4 sm:col-span-2">
          <Progress value={t.completedEcts} max={t.plannedEcts || 1} label="Tamamlanan AKTS (geçilen + muaf)" />
          <p className="mt-2 text-xs text-su-muted">
            {t.completedCount}/{t.plannedCount} ders tamam · kalan {t.remainingCount} ders, {t.remainingEcts} AKTS
            {s.track === 'CAP' && s.commonEcts > 0 && ` · ana dalda ortak sayılan ${s.commonEcts} AKTS ayrıca`}
          </p>
        </div>
        <Stat label={`${LABELS.trackShort[s.track]} ortalaması`} value={fmtGpa(trackGpa)} hint="Onaylı notlardan" />
        <Stat label="Ana dal GANO" value={fmtGpa(gano?.gano)} hint={gano ? `${termLabel(gano.term)} · ${LABELS.ganoSource[gano.source]}` : 'Koordinatör girer'} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle aside={<StudentStatusBadge value={s.status} />}>Öğrenci bilgileri</CardTitle>
          <dl className="grid grid-cols-[9rem_1fr] gap-y-1.5 text-sm">
            <dt className="text-su-muted">Öğrenci no</dt>
            <dd>{s.studentNo}</dd>
            <dt className="text-su-muted">Okul e-postası</dt>
            <dd className="break-all">{s.schoolEmail}</dd>
            <dt className="text-su-muted">Telefon</dt>
            <dd>{s.phone ?? '—'}</dd>
            <dt className="text-su-muted">Program</dt>
            <dd>{LABELS.track[s.track]}</dd>
            <dt className="text-su-muted">Kabul dönemi</dt>
            <dd>{termLabel(s.admissionTerm)}</dd>
            <dt className="text-su-muted">Ana dal</dt>
            <dd>{s.mainProgram?.name ?? '—'}</dd>
            <dt className="text-su-muted">Kayıt kaynağı</dt>
            <dd>
              {LABELS.source[s.source]} · {s.createdBy}, {fmtDate(s.createdAt)}
            </dd>
            {s.user && (
              <>
                <dt className="text-su-muted">Hesap</dt>
                <dd>
                  {s.user.active ? 'Etkin' : 'Pasif'} · {s.user.invitedAt ? `davet ${fmtDate(s.user.invitedAt)}` : 'davet gönderilmedi'} · son giriş {fmtDateTime(s.user.lastLoginAt)}
                </dd>
              </>
            )}
          </dl>
          {coord && s.user && (
            <ActionForm action={inviteAction} className="mt-3">
              <input type="hidden" name="username" value={s.user.username} />
              <SubmitButton size="sm" variant="outline">
                {s.user.invitedAt ? 'Şifre bağlantısını yeniden gönder' : 'Şifre belirleme bağlantısını gönder'}
              </SubmitButton>
            </ActionForm>
          )}
          {!coord && c.can.upload && (
            <ActionForm action={contactAction} className="mt-3 flex items-end gap-2 space-y-0">
              <input type="hidden" name="studentNo" value={s.studentNo} />
              <Field label="Telefonum">
                <Input name="phone" defaultValue={s.phone ?? ''} className="w-48" />
              </Field>
              <SubmitButton size="sm" variant="outline">
                Kaydet
              </SubmitButton>
            </ActionForm>
          )}
          {coord && (
            <details className="mt-4">
              <summary className="text-sm font-medium text-su-primary">Bilgileri düzelt</summary>
              <ActionForm action={updateStudentAction} className="mt-3">
                <input type="hidden" name="studentNo" value={s.studentNo} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Ad soyad">
                    <Input name="fullName" defaultValue={s.fullName} />
                  </Field>
                  <Field label="Okul e-postası">
                    <Input name="schoolEmail" type="email" defaultValue={s.schoolEmail} />
                  </Field>
                  <Field label="Program">
                    <Select name="track" defaultValue={s.track}>
                      {TRACK_TYPES.map((x) => (
                        <option key={x} value={x}>
                          {LABELS.track[x]}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Kabul dönemi">
                    <Select name="admissionTermId" defaultValue={s.admissionTermId}>
                      {c.terms.map((x) => (
                        <option key={x.id} value={x.id}>
                          {termLabel(x)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Ortak sayılan AKTS (ÇAP Yön. m.7/2)">
                    <Input name="commonEcts" type="number" min={0} max={240} defaultValue={s.commonEcts} />
                  </Field>
                  <input type="hidden" name="mainProgramId" value={s.mainProgramId ?? ''} />
                </div>
                <Field label="Düzeltme gerekçesi">
                  <Input name="reason" required minLength={5} />
                </Field>
                <SubmitButton size="sm">Kaydet</SubmitButton>
              </ActionForm>
            </details>
          )}
        </Card>

        <Card>
          <CardTitle aside={<WorstBadge value={c.live.worst} />}>
            Yönerge kuralları
            <span className="block text-xs font-normal text-su-muted">Kural seti {c.live.version} · yalnızca onaylı kayıtlar hesaba girer</span>
          </CardTitle>
          <RuleList results={[...c.live.termEnd, ...c.live.plan]} hideNa />
          <h3 className="mt-4 text-sm font-semibold text-su-heading">{s.track === 'CAP' ? 'Mezuniyet' : 'Sertifika'}</h3>
          <RuleList results={c.live.graduation} />
          {c.checks.length > 0 && (
            <details className="mt-3">
              <summary className="text-xs font-medium text-su-primary">Kayıtlı kontroller ({c.checks.length})</summary>
              <ul className="mt-2 space-y-1 text-xs text-su-muted">
                {c.checks.map((k) => (
                  <li key={k.id}>
                    {fmtDateTime(k.createdAt)} · {k.trigger} · {k.ruleSet.version} · <WorstBadge value={k.worst} />
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-[11px] text-su-subtle">Her kontrol, yapıldığı andaki kural sürümüyle saklanır; kural değişince yeniden yazılmaz.</p>
            </details>
          )}
        </Card>
      </div>

      <Card>
        <CardTitle>
          Ana dal GANO kayıtları
          <span className="block text-xs font-normal text-su-muted">Not ortalaması eşiklerinin dayanağıdır; yalnızca koordinatör girer ve kaynağını yazar.</span>
        </CardTitle>
        {s.ganoRecords.length === 0 ? (
          <Empty>GANO kaydı yok.</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Dönem</Th>
                <Th>GANO</Th>
                <Th>Kaynak</Th>
                <Th>Ana dal</Th>
                <Th>Giren</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {s.ganoRecords.map((g) => (
                <tr key={g.id} className={g.cancelledAt ? 'opacity-50' : undefined}>
                  <Td>{termLabel(g.term)}</Td>
                  <Td className="font-semibold">{fmtGpa(g.gano)}</Td>
                  <Td>
                    {LABELS.ganoSource[g.source]}
                    {g.sourceNote && <span className="block text-xs text-su-muted">{g.sourceNote}</span>}
                  </Td>
                  <Td className="text-xs">
                    {g.mainGraduated && <Badge tone="neutral">Mezun</Badge>} {g.mainFrozen && <Badge tone="warn">Dondurulmuş</Badge>}
                  </Td>
                  <Td className="text-xs">
                    {g.enteredBy ?? ''} {fmtDate(g.createdAt)}
                  </Td>
                  <Td>
                    {g.cancelledAt ? (
                      <span className="text-xs">İptal: {g.cancelReason}</span>
                    ) : (
                      coord && <ReasonAction action={cancelRecordAction} fields={{ ...no, kind: 'gano', id: g.id }} label="İptal et" />
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {coord && (
          <ActionForm action={ganoAction} className="mt-4 rounded-lg bg-su-bg p-3">
            <input type="hidden" name="studentNo" value={s.studentNo} />
            <div className="grid gap-3 sm:grid-cols-4">
              <Field label="Dönem">
                <Select name="termId" defaultValue={startedTerms.at(-1)?.id}>
                  {startedTerms.map((x) => (
                    <option key={x.id} value={x.id}>
                      {termLabel(x)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="GANO (4'lük)">
                <Input name="gano" required inputMode="decimal" pattern="[0-4]([.,][0-9]{1,2})?" />
              </Field>
              <Field label="Kaynak">
                <Select name="source">
                  {GANO_SOURCES.map((x) => (
                    <option key={x} value={x}>
                      {LABELS.ganoSource[x]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Kaynak notu">
                <Input name="sourceNote" placeholder="Ör. 2026-27 güz transkripti" />
              </Field>
            </div>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" name="mainFrozen" /> Ana dalda kayıt dondurulmuş
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="mainGraduated" /> Ana daldan mezun oldu
              </label>
            </div>
            <SubmitButton size="sm">GANO kaydet</SubmitButton>
          </ActionForm>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle>Dönem izinleri</CardTitle>
          {s.leaves.length === 0 ? (
            <Empty>İzin kaydı yok.</Empty>
          ) : (
            <ul className="space-y-1 text-sm">
              {s.leaves.map((l) => (
                <li key={l.id} className={l.cancelledAt ? 'opacity-50' : undefined}>
                  {termLabel(l.term)} · {LABELS.leave[l.reason]} {l.note && <span className="text-xs text-su-muted">({l.note})</span>}{' '}
                  {l.cancelledAt ? <span className="text-xs">iptal: {l.cancelReason}</span> : coord && <ReasonAction action={cancelRecordAction} fields={{ ...no, kind: 'leave', id: l.id }} label="İptal et" />}
                </li>
              ))}
            </ul>
          )}
          {coord && (
            <ActionForm action={leaveAction} className="mt-4 rounded-lg bg-su-bg p-3">
              <input type="hidden" name="studentNo" value={s.studentNo} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Dönem">
                  <Select name="termId" defaultValue={c.currentTerm?.id}>
                    {c.terms.map((x) => (
                      <option key={x.id} value={x.id}>
                        {termLabel(x)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="İzin gerekçesi">
                  <Select name="reason">
                    {LEAVE_REASONS.map((x) => (
                      <option key={x} value={x}>
                        {LABELS.leave[x]}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Field label="Not (karar sayısı vb.)">
                <Input name="note" />
              </Field>
              <SubmitButton size="sm" variant="outline">
                İzni kaydet
              </SubmitButton>
            </ActionForm>
          )}
        </Card>

        <Card>
          <CardTitle>
            Kararlar
            <span className="block text-xs font-normal text-su-muted">Sistem uyarır; mezuniyet, sertifika ve kayıt silme kararı koordinatördedir.</span>
          </CardTitle>
          {s.decisions.length === 0 ? (
            <Empty>Karar yok.</Empty>
          ) : (
            <ul className="space-y-2 text-sm">
              {s.decisions.map((d) => (
                <li key={d.id} className={d.cancelledAt ? 'opacity-50' : undefined}>
                  <span className="font-medium">{LABELS.decision[d.type]}</span> · {fmtDate(d.decidedAt)} · {d.decidedBy}
                  {d.reference && ` · ${d.reference}`}
                  <span className="block text-xs text-su-muted">
                    {d.reason} ({LABELS.studentStatus[d.previousStatus]} → {LABELS.studentStatus[d.newStatus]})
                  </span>
                  {d.cancelledAt ? <span className="text-xs">İptal: {d.cancelReason}</span> : coord && <ReasonAction action={cancelRecordAction} fields={{ ...no, kind: 'decision', id: d.id }} label="Kararı iptal et" confirm="Karar iptal edilecek ve öğrenci önceki durumuna dönecek." />}
                </li>
              ))}
            </ul>
          )}
          {coord && (
            <ActionForm action={decisionAction} className="mt-4 rounded-lg bg-su-bg p-3">
              <input type="hidden" name="studentNo" value={s.studentNo} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Karar">
                  <Select name="type" defaultValue={c.live.graduationReady ? (s.track === 'CAP' ? 'MEZUNIYET' : 'SERTIFIKA') : 'DONDURMA'}>
                    {DECISION_TYPES.filter((x) => !(x === 'MEZUNIYET' && s.track !== 'CAP') && !(x === 'SERTIFIKA' && s.track !== 'YANDAL')).map((x) => (
                      <option key={x} value={x}>
                        {LABELS.decision[x]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Dayanak (karar sayısı)">
                  <Input name="reference" placeholder="FYK 2026/50-4" />
                </Field>
              </div>
              <Field label="Gerekçe">
                <Input name="reason" required minLength={5} />
              </Field>
              <SubmitButton size="sm" confirm="Karar öğrencinin durumunu değiştirecek ve öğrenciye bildirilecek. Devam edilsin mi?">
                Kararı kaydet
              </SubmitButton>
              <p className="text-[11px] text-su-subtle">Karar anındaki kural kontrolü kayda bağlanır.</p>
            </ActionForm>
          )}
        </Card>
      </div>
      {!coord && c.can.upload && (
        <p className="text-xs text-su-muted">
          Bilgilerinizde yanlışlık varsa koordinatöre <Link href={`/ogrenciler/${s.studentNo}?sekme=mesajlar`}>mesaj</Link> gönderin.
        </p>
      )}
    </>
  );
}
