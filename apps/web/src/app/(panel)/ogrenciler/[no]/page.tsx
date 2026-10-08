import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LABELS } from '@cap/contracts';
import { CoursesTab } from '@/components/card/courses';
import { DocumentsTab } from '@/components/card/documents';
import { GradesTab } from '@/components/card/grades';
import { HistoryTab, NotesTab } from '@/components/card/staff';
import { MessagesTab } from '@/components/card/messages';
import { SummaryTab } from '@/components/card/summary';
import { StudentStatusBadge, WorstBadge } from '@/components/status';
import { Alert, Page, PageHero } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { cn, termLabel } from '@/lib/format';
import { getMe } from '@/lib/me';
import type { AuditRow, Course, DocumentRequestRow, DocumentRow, MessageRow, StudentCard } from '@/lib/types';

export const metadata = { title: 'Öğrenci kartı' };

const TABS = [
  { key: 'ozet', label: 'Durum' },
  { key: 'dersler', label: 'Dersler' },
  { key: 'notlar', label: 'Dönem sonu notları' },
  { key: 'belgeler', label: 'Belgeler' },
  { key: 'mesajlar', label: 'Mesajlar' },
  { key: 'gizli', label: 'Koordinatör notları', staff: true },
  { key: 'gecmis', label: 'İşlem geçmişi', staff: true },
] as const;

/** Öğrenci kartı: öğrencinin kendisi, koordinatör ve bölüm başkanı aynı kartı yetkilerine göre görür. */
export default async function StudentPage({ params, searchParams }: { params: Promise<{ no: string }>; searchParams: Promise<{ sekme?: string; eklendi?: string }> }) {
  const [{ no }, { sekme, eklendi }] = await Promise.all([params, searchParams]);
  if (!/^\d{9}$/.test(no)) notFound();
  const me = (await getMe())!;
  let c: StudentCard;
  try {
    c = await api<StudentCard>(`/students/${no}`);
  } catch (e) {
    if (e instanceof ApiError && e.problem.status === 404) notFound();
    throw e;
  }
  const staff = me.role !== 'OGRENCI';
  const tabs = TABS.filter((t) => !('staff' in t) || staff);
  const tab = tabs.find((t) => t.key === sekme)?.key ?? 'ozet';
  const s = c.student;

  const [docs, messages, notes, history, catalog] = await Promise.all([
    tab === 'belgeler' || tab === 'notlar' || tab === 'dersler' ? api<{ documents: DocumentRow[]; requests: DocumentRequestRow[] }>(`/students/${no}/documents`) : null,
    tab === 'mesajlar' ? api<MessageRow[]>(`/students/${no}/messages`) : null,
    tab === 'gizli' ? api<{ id: string; body: string; createdAt: string; author: { displayName: string }; cancelledAt: string | null; cancelReason: string | null }[]>(`/students/${no}/notes`) : null,
    tab === 'gecmis' ? api<AuditRow[]>(`/students/${no}/history`) : null,
    tab === 'dersler' ? api<Course[]>('/courses') : null,
  ]);

  return (
    <>
      <PageHero
        title={s.fullName}
        crumbs={[staff ? 'Öğrenciler' : 'Kartım', s.studentNo]}
        subtitle={
          <>
            {LABELS.track[s.track]} · kabul {termLabel(s.admissionTerm)}
            {s.mainProgram && ` · ana dal: ${s.mainProgram.name}`}
          </>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <StudentStatusBadge value={s.status} />
            <WorstBadge value={c.live.worst} />
          </div>
        }
      />
      <nav aria-label="Kart sekmeleri" className="no-print border-b border-su-border/70 bg-white">
        <ul className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 sm:px-6">
          {tabs.map((t) => (
            <li key={t.key}>
              <Link
                href={t.key === 'ozet' ? `/ogrenciler/${no}` : `/ogrenciler/${no}?sekme=${t.key}`}
                aria-current={t.key === tab ? 'page' : undefined}
                className={cn(
                  'block whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium no-underline',
                  t.key === tab ? 'border-su-accent text-su-primary' : 'border-transparent text-su-muted hover:text-su-primary',
                )}
              >
                {t.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <Page>
        {eklendi && <Alert tone="ok" title="Öğrenci eklendi.">Hesap açıldı. Ders listesini şablondan oluşturabilir, geçmiş dönem derslerini girebilirsiniz.</Alert>}
        {me.role === 'BOLUM_BASKANI' && <Alert tone="info" title="İzleme görünümü: kayıtları görebilirsiniz, değiştiremezsiniz." />}
        {tab === 'ozet' && <SummaryTab c={c} />}
        {tab === 'dersler' && <CoursesTab c={c} catalog={catalog!} />}
        {tab === 'notlar' && <GradesTab c={c} documents={docs!.documents} />}
        {tab === 'belgeler' && <DocumentsTab c={c} documents={docs!.documents} requests={docs!.requests} />}
        {tab === 'mesajlar' && <MessagesTab c={c} messages={messages!} me={me} />}
        {tab === 'gizli' && <NotesTab c={c} notes={notes!} />}
        {tab === 'gecmis' && <HistoryTab rows={history!} />}
      </Page>
    </>
  );
}
