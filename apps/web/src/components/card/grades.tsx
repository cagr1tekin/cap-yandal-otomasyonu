import Link from 'next/link';
import { CONDITIONAL_GRADES, GRADES, type Grade } from '@cap/contracts';
import { ActionForm, SubmitButton } from '@/components/forms';
import { ReasonAction, ReviewButtons } from '@/components/inline';
import { ReviewBadge } from '@/components/status';
import { Alert, Card, CardTitle, Empty, Field, Select, Table, Td, Th } from '@/components/ui';
import { cancelRecordAction, gradesAction, reviewAction } from '@/lib/actions';
import { fmtDateTime, termLabel } from '@/lib/format';
import type { DocumentRow, StudentCard } from '@/lib/types';

/**
 * Dönem sonu: öğrenci önceki dönemin notlarını girer ve bölümde aldığı derslerin not belgesini
 * (ÇAP / YDP transkripti) yükler. Belge yüklenmeden notlar onaya gönderilemez; koordinatör karşılaştırıp onaylar.
 */
export function GradesTab({ c, documents }: { c: StudentCard; documents: DocumentRow[] }) {
  const s = c.student;
  const coord = c.can.coordinator;
  const pendingAttempts = new Set(c.gradeSubmissions.filter((g) => g.status === 'PENDING').flatMap((g) => g.items.map((i) => i.attemptId)));
  const open = c.gradeable.filter((a) => !pendingAttempts.has(a.id));
  const terms = [...new Map(open.map((a) => [a.termId, a.term])).values()];
  const transcripts = (termId: string) => documents.filter((d) => d.kind === 'CAP_TRANSKRIPT' && d.termId === termId && (d.status === 'PENDING' || d.status === 'APPROVED'));

  return (
    <>
      {c.can.submitGrades && (
        <Card>
          <CardTitle>
            Notu girilecek dersler
            <span className="block text-xs font-normal text-su-muted">Dönem kaydı onaylanmış, notu henüz işlenmemiş dersler.</span>
          </CardTitle>
          {terms.length === 0 ? (
            <Empty>Notu girilecek ders yok.</Empty>
          ) : (
            terms.map((t) => {
              const docs = transcripts(t.id);
              return (
                <div key={t.id} className="mb-5 rounded-xl border border-su-border/70 p-4">
                  <h3 className="mb-2 text-base font-semibold">{termLabel(t)}</h3>
                  {docs.length === 0 ? (
                    <Alert tone="warn" title="Bu dönemin ÇAP / YDP not belgesi yüklenmedi.">
                      Notlar onaya gönderilemez. Önce <Link href={`/ogrenciler/${s.studentNo}?sekme=belgeler&donem=${t.id}`}>Belgeler</Link> sekmesinden “ÇAP / YDP not belgesi (transkript)” türünde, {termLabel(t)} dönemi için yükleyin.
                    </Alert>
                  ) : (
                    <ActionForm action={gradesAction}>
                      <input type="hidden" name="studentNo" value={s.studentNo} />
                      <input type="hidden" name="termId" value={t.id} />
                      <Field label="Not belgesi">
                        <Select name="transcriptId">
                          {docs.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.fileName} · {fmtDateTime(d.uploadedAt)}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Table>
                        <thead>
                          <tr>
                            <Th>Ders</Th>
                            <Th>AKTS</Th>
                            <Th>Not</Th>
                          </tr>
                        </thead>
                        <tbody>
                          {open
                            .filter((a) => a.termId === t.id)
                            .map((a) => (
                              <tr key={a.id}>
                                <Td>
                                  <span className="font-mono text-xs">{a.courseCode}</span> {a.courseName}
                                </Td>
                                <Td>{a.ects}</Td>
                                <Td>
                                  <Select name={`grade:${a.id}`} defaultValue="" aria-label={`${a.courseName} notu`} className="w-28">
                                    <option value="">—</option>
                                    {GRADES.map((g) => (
                                      <option key={g} value={g}>
                                        {g}
                                      </option>
                                    ))}
                                  </Select>
                                </Td>
                              </tr>
                            ))}
                        </tbody>
                      </Table>
                      <SubmitButton size="sm">{coord ? 'Notları kaydet (onaylı)' : 'Notları onaya gönder'}</SubmitButton>
                    </ActionForm>
                  )}
                </div>
              );
            })
          )}
        </Card>
      )}

      <Card>
        <CardTitle>Not gönderimleri</CardTitle>
        {c.gradeSubmissions.length === 0 ? (
          <Empty>Henüz not gönderimi yok.</Empty>
        ) : (
          <div className="space-y-4">
            {c.gradeSubmissions.map((g) => (
              <div key={g.id} className={`rounded-xl border border-su-border/70 p-4 ${g.status === 'CANCELLED' ? 'opacity-60' : ''}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">
                    {termLabel(g.term)} <ReviewBadge value={g.status} />
                  </p>
                  <p className="text-xs text-su-muted">
                    {g.submittedBy} · {fmtDateTime(g.submittedAt)} · not belgesi:{' '}
                    <a href={`/api/belge/${g.transcript.id}`} target="_blank" rel="noreferrer">
                      {g.transcript.fileName}
                    </a>
                  </p>
                </div>
                {g.reviewNote && <p className="text-xs text-su-muted">Koordinatör: {g.reviewNote}</p>}
                <Table className="mt-2">
                  <thead>
                    <tr>
                      <Th>Ders</Th>
                      <Th>AKTS</Th>
                      <Th>Beyan edilen not</Th>
                      <Th>Sonuç</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.items.map((i) => (
                      <tr key={i.id}>
                        <Td>
                          <span className="font-mono text-xs">{i.attempt.courseCode}</span> {i.attempt.courseName}
                        </Td>
                        <Td>{i.attempt.ects}</Td>
                        <Td className="font-semibold">{i.grade}</Td>
                        <Td>{i.passed === null ? '—' : i.passed ? 'Geçti' : 'Kaldı'}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
                {g.status === 'PENDING' && (
                  <div className="mt-3 flex flex-wrap items-end gap-3">
                    {coord && (
                      <ReviewButtons action={reviewAction} kind="grades" id={g.id}>
                        {g.items
                          .filter((i) => CONDITIONAL_GRADES.includes(i.grade as Grade))
                          .map((i) => (
                            <label key={i.id} className="flex items-center gap-1 text-xs">
                              <input type="checkbox" name="conditionalPass" value={i.attemptId} /> {i.attempt.courseCode} DC başarılı
                            </label>
                          ))}
                      </ReviewButtons>
                    )}
                    {(coord || c.can.submitGrades) && <ReasonAction action={cancelRecordAction} fields={{ studentNo: s.studentNo, kind: 'grades', id: g.id }} label={coord ? 'İptal et' : 'Geri çek'} />}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
