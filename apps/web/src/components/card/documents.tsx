import { DOCUMENT_KINDS, LABELS, STAFF_ONLY_DOCUMENTS, TERM_DOCUMENTS } from '@cap/contracts';
import { ActionForm, SubmitButton } from '@/components/forms';
import { ReasonAction, ReviewButtons } from '@/components/inline';
import { RequestBadge, ReviewBadge } from '@/components/status';
import { Alert, Card, CardTitle, Empty, Field, Input, Select, Table, Td, Th } from '@/components/ui';
import { cancelRecordAction, documentRequestAction, reviewAction, uploadAction } from '@/lib/actions';
import { fmtDate, fmtDateTime, termLabel } from '@/lib/format';
import type { DocumentRequestRow, DocumentRow, StudentCard } from '@/lib/types';

/**
 * Belge arşivi: imzalı formlar, dönem not belgeleri, resmî yazılar. Belge silinmez; reddedilen ya da
 * yenilenen belgenin eski sürümü arşivde kalır. Koordinatörün istekleri ve yanıtları izlenir.
 */
export function DocumentsTab({ c, documents, requests }: { c: StudentCard; documents: DocumentRow[]; requests: DocumentRequestRow[] }) {
  const s = c.student;
  const coord = c.can.coordinator;
  const no = { studentNo: s.studentNo };
  const replaced = new Set(documents.map((d) => d.previousId).filter(Boolean));
  const latest = documents.filter((d) => !replaced.has(d.id) && !d.messageId);
  const openRequests = requests.filter((r) => r.status === 'OPEN' || r.status === 'REJECTED');
  const kinds = coord ? DOCUMENT_KINDS : DOCUMENT_KINDS.filter((k) => !STAFF_ONLY_DOCUMENTS.includes(k));
  const started = c.terms.filter((t) => new Date(t.startsAt) <= new Date());

  return (
    <>
      {openRequests.length > 0 && (
        <Alert tone="warn" title={coord ? `${openRequests.length} yanıt bekleyen belge isteği` : 'Koordinatör sizden belge istiyor'}>
          <ul className="list-disc pl-4">
            {openRequests.map((r) => (
              <li key={r.id}>
                {LABELS.document[r.kind]}: {r.message}
                {r.dueDate && ` (son gün ${fmtDate(r.dueDate)})`} · <RequestBadge value={r.status} />
              </li>
            ))}
          </ul>
        </Alert>
      )}

      {c.can.upload && (
        <Card>
          <CardTitle>
            Belge yükle
            <span className="block text-xs font-normal text-su-muted">PDF, JPG ya da PNG. Dosya içeriği denetlenir; bozuk ya da zararlı dosya kabul edilmez. Öğrenci belgesini silemez.</span>
          </CardTitle>
          <ActionForm action={uploadAction}>
            <input type="hidden" name="studentNo" value={s.studentNo} />
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Belge türü">
                <Select name="kind" defaultValue={openRequests[0]?.kind ?? 'PROTOKOL'}>
                  {kinds.map((k) => (
                    <option key={k} value={k}>
                      {LABELS.document[k]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Dönem" hint={`Zorunlu: ${TERM_DOCUMENTS.map((k) => LABELS.document[k]).join(', ')}`}>
                <Select name="termId" defaultValue="">
                  <option value="">—</option>
                  {started.map((t) => (
                    <option key={t.id} value={t.id}>
                      {termLabel(t)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Dosya">
                <Input name="file" type="file" required accept="application/pdf,image/jpeg,image/png" />
              </Field>
              <Field label="Yeni sürümü olduğu belge (isteğe bağlı)">
                <Select name="replacesId" defaultValue="">
                  <option value="">—</option>
                  {latest.map((d) => (
                    <option key={d.id} value={d.id}>
                      {LABELS.document[d.kind]} · {d.fileName} ({LABELS.review[d.status]})
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Yanıtladığı istek (isteğe bağlı)">
                <Select name="requestId" defaultValue={openRequests[0]?.id ?? ''}>
                  <option value="">—</option>
                  {openRequests.map((r) => (
                    <option key={r.id} value={r.id}>
                      {LABELS.document[r.kind]}: {r.message.slice(0, 40)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Not">
                <Input name="note" />
              </Field>
            </div>
            <SubmitButton pending="Yükleniyor…">Yükle</SubmitButton>
          </ActionForm>
        </Card>
      )}

      <Card>
        <CardTitle>Belge arşivi ({documents.length})</CardTitle>
        {documents.length === 0 ? (
          <Empty>Belge yok.</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Belge</Th>
                <Th>Dönem</Th>
                <Th>Yükleyen</Th>
                <Th>Durum</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {documents.map((d) => (
                <tr key={d.id} className={replaced.has(d.id) || d.status === 'CANCELLED' ? 'opacity-60' : undefined}>
                  <Td>
                    <a href={`/api/belge/${d.id}`} target="_blank" rel="noreferrer" className="font-medium">
                      {d.fileName}
                    </a>
                    <span className="block text-xs text-su-muted">
                      {LABELS.document[d.kind]} · {Math.max(1, Math.round(d.size / 1024))} KB
                      {replaced.has(d.id) && ' · yeni sürümü var'}
                      {d.previousId && ' · önceki sürümün yenisi'}
                      {d.messageId && ' · mesaj eki'}
                      {d.request && ` · istek: ${d.request.message.slice(0, 40)}`}
                    </span>
                    {d.note && <span className="block text-xs text-su-subtle">{d.note}</span>}
                  </Td>
                  <Td className="text-xs">{d.term ? termLabel(d.term) : '—'}</Td>
                  <Td className="text-xs">
                    {d.uploadedBy}
                    <span className="block">{fmtDateTime(d.uploadedAt)}</span>
                  </Td>
                  <Td>
                    <ReviewBadge value={d.status} />
                    {d.reviewNote && <span className="block text-xs text-su-muted">{d.reviewNote}</span>}
                  </Td>
                  <Td>
                    <div className="flex flex-col items-start gap-1.5">
                      {coord && d.status === 'PENDING' && <ReviewButtons action={reviewAction} kind="document" id={d.id} />}
                      {coord && d.status !== 'CANCELLED' && <ReasonAction action={cancelRecordAction} fields={{ ...no, kind: 'document', id: d.id }} label="İptal et" />}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Card>
        <CardTitle>Belge istekleri</CardTitle>
        {requests.length === 0 ? (
          <Empty>İstek yok.</Empty>
        ) : (
          <ul className="space-y-2 text-sm">
            {requests.map((r) => (
              <li key={r.id}>
                <span className="font-medium">{LABELS.document[r.kind]}</span> · {r.message} <RequestBadge value={r.status} />
                <span className="block text-xs text-su-muted">
                  {r.createdBy}, {fmtDate(r.createdAt)}
                  {r.dueDate && ` · son gün ${fmtDate(r.dueDate)}`}
                  {r.documents.length > 0 && ` · yanıt: ${r.documents.map((d) => d.fileName).join(', ')}`}
                </span>
                {coord && !['APPROVED', 'CANCELLED'].includes(r.status) && <ReasonAction action={cancelRecordAction} fields={{ ...no, kind: 'request', id: r.id }} label="İsteği iptal et" />}
              </li>
            ))}
          </ul>
        )}
        {coord && (
          <ActionForm action={documentRequestAction} className="mt-4 rounded-lg bg-su-bg p-3">
            <input type="hidden" name="studentNo" value={s.studentNo} />
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="İstenen belge">
                <Select name="kind">
                  {DOCUMENT_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {LABELS.document[k]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Dönem (isteğe bağlı)">
                <Select name="termId" defaultValue="">
                  <option value="">—</option>
                  {started.map((t) => (
                    <option key={t.id} value={t.id}>
                      {termLabel(t)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Son gün">
                <Input name="dueDate" type="date" />
              </Field>
            </div>
            <Field label="Açıklama">
              <Input name="message" required minLength={5} />
            </Field>
            <SubmitButton size="sm" variant="outline">
              Belge iste
            </SubmitButton>
          </ActionForm>
        )}
      </Card>
    </>
  );
}
