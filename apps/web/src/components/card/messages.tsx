import { DOCUMENT_KINDS, LABELS, STAFF_ONLY_DOCUMENTS } from '@cap/contracts';
import { ActionForm, SubmitButton } from '@/components/forms';
import { Card, CardTitle, Empty, Field, Input, Select, Textarea } from '@/components/ui';
import { messageAction } from '@/lib/actions';
import { cn, fmtDateTime } from '@/lib/format';
import type { Me, MessageRow, StudentCard } from '@/lib/types';

/** Koordinatör–öğrenci yazışması. Kalıcıdır; silinemez ve değiştirilemez. */
export function MessagesTab({ c, messages, me }: { c: StudentCard; messages: MessageRow[]; me: Me }) {
  const kinds = me.role === 'KOORDINATOR' ? DOCUMENT_KINDS : DOCUMENT_KINDS.filter((k) => !STAFF_ONLY_DOCUMENTS.includes(k));
  return (
    <Card>
      <CardTitle>
        Yazışma
        <span className="block text-xs font-normal text-su-muted">Mesajlar kalıcı kayıttır; silinemez. Yeni mesajda karşı taraf bildirim ve e-posta alır.</span>
      </CardTitle>
      {messages.length === 0 ? (
        <Empty>Henüz mesaj yok.</Empty>
      ) : (
        <ol className="space-y-3">
          {messages.map((m) => {
            const mine = m.sender.username === me.username;
            return (
              <li key={m.id} className={cn('max-w-[85%] rounded-2xl border p-3 text-sm', mine ? 'ml-auto border-su-primary/30 bg-su-primary-soft' : 'border-su-border/70 bg-white')}>
                <p className="mb-1 text-xs text-su-muted">
                  <span className="font-semibold text-su-heading">{m.sender.displayName}</span> · {LABELS.role[m.sender.role]} · {fmtDateTime(m.createdAt)}
                  {mine && m.readAt && ' · okundu'}
                </p>
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                {m.attachments.map((a) => (
                  <a key={a.id} href={`/api/belge/${a.id}`} target="_blank" rel="noreferrer" className="mt-1 block text-xs">
                    📎 {a.fileName} ({LABELS.document[a.kind]})
                  </a>
                ))}
              </li>
            );
          })}
        </ol>
      )}
      {c.can.message && (
        <ActionForm action={messageAction} className="mt-5 rounded-lg bg-su-bg p-3">
          <input type="hidden" name="studentNo" value={c.student.studentNo} />
          <Field label="Mesaj">
            <Textarea name="body" required maxLength={20000} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Ek (isteğe bağlı)" hint="Ek, belge arşivine de düşer">
              <Input name="file" type="file" accept="application/pdf,image/jpeg,image/png" />
            </Field>
            <Field label="Ekin türü">
              <Select name="attachmentKind" defaultValue="DIGER">
                {kinds.map((k) => (
                  <option key={k} value={k}>
                    {LABELS.document[k]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <SubmitButton>Gönder</SubmitButton>
        </ActionForm>
      )}
    </Card>
  );
}
