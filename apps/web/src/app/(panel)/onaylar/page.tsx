import Link from 'next/link';
import { CONDITIONAL_GRADES, LABELS, type DocumentKind, type Grade, type TrackType } from '@cap/contracts';
import { ReviewButtons } from '@/components/inline';
import { Badge, Card, CardTitle, Empty, Page, PageHero, Table, Td, Th } from '@/components/ui';
import { reviewAction } from '@/lib/actions';
import { api } from '@/lib/api';
import { fmtDateTime, termLabel } from '@/lib/format';
import { getMe } from '@/lib/me';
import type { Term } from '@/lib/types';

export const metadata = { title: 'Onay bekleyenler' };

type Who = { studentNo: string; student: { fullName: string; track: TrackType } };
interface Pending {
  plan: (Who & { id: string; courseCode: string; name: string; ects: number; semester: number; addReason: string | null; createdAt: string })[];
  attempts: (Who & { id: string; courseCode: string; courseName: string; ects: number; term: Term; createdAt: string })[];
  grades: (Who & { id: string; term: Term; submittedAt: string; transcript: { id: string; fileName: string }; items: { id: string; attemptId: string; grade: string; attempt: { courseCode: string; courseName: string } }[] })[];
  documents: (Who & { id: string; kind: DocumentKind; fileName: string; term: Term | null; uploadedAt: string; previousId: string | null; request: { message: string } | null })[];
  courseRequests: (Who & { id: string; code: string | null; name: string; note: string })[];
  total: number;
}

const Student = ({ r }: { r: Who }) => (
  <>
    <Link href={`/ogrenciler/${r.studentNo}`} className="font-medium">
      {r.student.fullName}
    </Link>
    <span className="block text-xs text-su-subtle">
      {r.studentNo} · {LABELS.trackShort[r.student.track]}
    </span>
  </>
);

/** Onay kuyruğu: öğrencinin girdiği ders, dönem kaydı, not ve belgeler. Onaylanan kayıt kilitlenir. */
export default async function Reviews() {
  const [p, me] = await Promise.all([api<Pending>('/reviews'), getMe()]);
  const coord = me?.role === 'KOORDINATOR';
  const actions = (kind: string, id: string, extra?: React.ReactNode) => (coord ? <ReviewButtons action={reviewAction} kind={kind} id={id}>{extra}</ReviewButtons> : <Badge tone="warn">Bekliyor</Badge>);

  return (
    <>
      <PageHero title="Onay bekleyenler" crumbs={['Öğrenci takibi']} subtitle={`${p.total} kayıt. Onaylanana kadar kural hesaplarına girmez; onaylanan kaydı öğrenci değiştiremez. Ret gerekçesi öğrenciye bildirilir.`} />
      <Page>
        <Card>
          <CardTitle>Dönem sonu notları ({p.grades.length})</CardTitle>
          {p.grades.length === 0 ? (
            <Empty>Bekleyen not gönderimi yok.</Empty>
          ) : (
            <div className="space-y-4">
              {p.grades.map((g) => (
                <div key={g.id} className="rounded-xl border border-su-border/70 p-4">
                  <div className="flex flex-wrap justify-between gap-2">
                    <div>
                      <Student r={g} />
                    </div>
                    <p className="text-sm">
                      {termLabel(g.term)} · not belgesi:{' '}
                      <a href={`/api/belge/${g.transcript.id}`} target="_blank" rel="noreferrer">
                        {g.transcript.fileName}
                      </a>
                    </p>
                  </div>
                  <ul className="my-2 text-sm">
                    {g.items.map((i) => (
                      <li key={i.id}>
                        <span className="font-mono text-xs">{i.attempt.courseCode}</span> {i.attempt.courseName}: <strong>{i.grade}</strong>
                      </li>
                    ))}
                  </ul>
                  {actions(
                    'grades',
                    g.id,
                    g.items
                      .filter((i) => CONDITIONAL_GRADES.includes(i.grade as Grade))
                      .map((i) => (
                        <label key={i.id} className="flex items-center gap-1 text-xs">
                          <input type="checkbox" name="conditionalPass" value={i.attemptId} /> {i.attempt.courseCode} DC başarılı
                        </label>
                      )),
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardTitle>Belgeler ({p.documents.length})</CardTitle>
          {p.documents.length === 0 ? (
            <Empty>Bekleyen belge yok.</Empty>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Öğrenci</Th>
                  <Th>Belge</Th>
                  <Th>Yüklenme</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {p.documents.map((d) => (
                  <tr key={d.id}>
                    <Td>
                      <Student r={d} />
                    </Td>
                    <Td>
                      <a href={`/api/belge/${d.id}`} target="_blank" rel="noreferrer">
                        {d.fileName}
                      </a>
                      <span className="block text-xs text-su-muted">
                        {LABELS.document[d.kind]}
                        {d.term && ` · ${termLabel(d.term)}`}
                        {d.previousId && ' · yeni sürüm'}
                        {d.request && ` · istek yanıtı`}
                      </span>
                    </Td>
                    <Td className="text-xs">{fmtDateTime(d.uploadedAt)}</Td>
                    <Td>{actions('document', d.id)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardTitle>Ders listesi ({p.plan.length})</CardTitle>
            {p.plan.length === 0 ? (
              <Empty>Bekleyen ders yok.</Empty>
            ) : (
              <ul className="divide-y divide-su-border/60">
                {p.plan.map((i) => (
                  <li key={i.id} className="space-y-1.5 py-3 text-sm">
                    <Student r={i} />
                    <p>
                      <span className="font-mono text-xs">{i.courseCode}</span> {i.name} · {i.ects} AKTS · {i.semester}. yy
                      {i.addReason && <span className="block text-xs text-su-muted">{i.addReason}</span>}
                    </p>
                    {actions('plan', i.id)}
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <CardTitle>Dönem dersleri ({p.attempts.length})</CardTitle>
            {p.attempts.length === 0 ? (
              <Empty>Bekleyen dönem kaydı yok.</Empty>
            ) : (
              <ul className="divide-y divide-su-border/60">
                {p.attempts.map((a) => (
                  <li key={a.id} className="space-y-1.5 py-3 text-sm">
                    <Student r={a} />
                    <p>
                      {termLabel(a.term)} · <span className="font-mono text-xs">{a.courseCode}</span> {a.courseName} · {a.ects} AKTS
                    </p>
                    {actions('attempt', a.id)}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {p.courseRequests.length > 0 && (
          <Card>
            <CardTitle aside={<Link href="/katalog?sekme=talepler">Katalogda sonuçlandır</Link>}>Katalog dışı ders talepleri ({p.courseRequests.length})</CardTitle>
            <ul className="space-y-1 text-sm">
              {p.courseRequests.map((r) => (
                <li key={r.id}>
                  {r.student.fullName}: {r.code} {r.name} <span className="text-xs text-su-muted">({r.note})</span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </Page>
    </>
  );
}
