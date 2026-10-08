import { LABELS } from '@cap/contracts';
import { ActionForm, SubmitButton } from '@/components/forms';
import { ReasonAction } from '@/components/inline';
import { Card, CardTitle, Empty, Field, Table, Td, Textarea, Th } from '@/components/ui';
import { cancelRecordAction, noteAction } from '@/lib/actions';
import { fmtDateTime } from '@/lib/format';
import type { AuditRow, StudentCard } from '@/lib/types';

type Note = { id: string; body: string; createdAt: string; author: { displayName: string }; cancelledAt: string | null; cancelReason: string | null };

/** Koordinatörün öğrenci kartına eklediği notlar; öğrenci görmez. */
export function NotesTab({ c, notes }: { c: StudentCard; notes: Note[] }) {
  const coord = c.can.coordinator;
  return (
    <Card>
      <CardTitle>
        Koordinatör notları
        <span className="block text-xs font-normal text-su-muted">Bu notları öğrenci görmez. Not silinmez; yanlış not iptal edilir.</span>
      </CardTitle>
      {notes.length === 0 ? (
        <Empty>Not yok.</Empty>
      ) : (
        <ul className="space-y-3">
          {notes.map((n) => (
            <li key={n.id} className={`rounded-lg border border-su-border/70 p-3 text-sm ${n.cancelledAt ? 'opacity-60' : ''}`}>
              <p className="whitespace-pre-wrap">{n.body}</p>
              <p className="mt-1 text-xs text-su-muted">
                {n.author.displayName} · {fmtDateTime(n.createdAt)}
                {n.cancelledAt && ` · iptal: ${n.cancelReason}`}
              </p>
              {coord && !n.cancelledAt && <ReasonAction action={cancelRecordAction} fields={{ studentNo: c.student.studentNo, kind: 'note', id: n.id }} label="İptal et" />}
            </li>
          ))}
        </ul>
      )}
      {coord && (
        <ActionForm action={noteAction} className="mt-4 rounded-lg bg-su-bg p-3">
          <input type="hidden" name="studentNo" value={c.student.studentNo} />
          <Field label="Yeni not">
            <Textarea name="body" required minLength={2} />
          </Field>
          <SubmitButton size="sm">Not ekle</SubmitButton>
        </ActionForm>
      )}
    </Card>
  );
}

const short = (v: unknown) => {
  if (v == null) return '';
  const s = JSON.stringify(v);
  return s.length > 160 ? `${s.slice(0, 160)}…` : s;
};

/** Kartın işlem geçmişi: kim, ne zaman, neyi, eski ve yeni değeriyle ne yaptı. */
export function HistoryTab({ rows }: { rows: AuditRow[] }) {
  return (
    <Card>
      <CardTitle>
        İşlem geçmişi
        <span className="block text-xs font-normal text-su-muted">Kayıtlar yalnızca eklenir; değiştirilemez ve silinemez.</span>
      </CardTitle>
      {rows.length === 0 ? (
        <Empty>Kayıt yok.</Empty>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Zaman</Th>
              <Th>Kim</Th>
              <Th>İşlem</Th>
              <Th>Eski → yeni</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <Td className="whitespace-nowrap text-xs">{fmtDateTime(r.at)}</Td>
                <Td className="text-xs">
                  {r.actor}
                  {r.actorRole && <span className="block text-su-subtle">{LABELS.role[r.actorRole]}</span>}
                </Td>
                <Td className="font-mono text-xs">
                  {r.action}
                  <span className="block font-sans text-su-subtle">{r.entity}</span>
                </Td>
                <Td className="max-w-md break-all font-mono text-[11px] text-su-muted">
                  {r.reason && <span className="block font-sans text-xs text-su-text">Gerekçe: {r.reason}</span>}
                  {r.before != null && <span className="block">önce: {short(r.before)}</span>}
                  {r.after != null && <span className="block">sonra: {short(r.after)}</span>}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  );
}
