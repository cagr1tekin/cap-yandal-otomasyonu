import Link from 'next/link';
import { LABELS, type TrackType } from '@cap/contracts';
import { buttonVariants, Card, CardTitle, Empty, Page, PageHero, Stat, Table, Td, Th } from '@/components/ui';
import { api } from '@/lib/api';
import { cn, termLabel } from '@/lib/format';
import type { Term } from '@/lib/types';

export const metadata = { title: 'Raporlar' };

interface Summary {
  term: Term | null;
  totals: Record<'offerings' | 'quota' | 'applications' | 'accepted' | 'enrolled' | 'activeEnrollments' | 'removedEnrollments' | 'pendingFindings', number>;
  rows: {
    offeringId: string;
    unitName: string;
    programName: string;
    type: TrackType;
    quota: number;
    applications: number;
    accepted: number;
    enrolled: number;
    fillRate: number;
    activeEnrollments: number;
    removedEnrollments: number;
  }[];
}

export default async function Reports({ searchParams }: { searchParams: Promise<{ donem?: string }> }) {
  const { donem } = await searchParams;
  const terms = await api<Term[]>('/terms');
  const termId = donem ?? terms.find((t) => t.isCurrent)?.id;
  const r = await api<Summary>(`/reports/summary${termId ? `?termId=${termId}` : ''}`);
  const t = r.totals;
  const maxApps = Math.max(1, ...r.rows.map((x) => x.applications));

  return (
    <>
      <PageHero title="Raporlar" subtitle={r.term ? termLabel(r.term) : undefined} />
      <Page>
        <div className="flex flex-wrap gap-2" aria-label="Dönem">
          {terms.map((x) => (
            <Link key={x.id} href={`?donem=${x.id}`} className={cn(buttonVariants({ size: 'sm', variant: x.id === termId ? 'accent' : 'outline' }), 'no-underline')}>
              {termLabel(x)}
            </Link>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Teklif / kontenjan" value={`${t.offerings} / ${t.quota}`} />
          <Stat label="Başvuru" value={t.applications} />
          <Stat label="Kabul / kesin kayıt" value={`${t.accepted} / ${t.enrolled}`} />
          <Stat label="Etkin kayıt / silinen" value={`${t.activeEnrollments} / ${t.removedEnrollments}`} hint={`${t.pendingFindings} bulgu karar bekliyor`} />
        </div>
        <Card>
          <CardTitle>Program bazında</CardTitle>
          {r.rows.length === 0 ? (
            <Empty>Bu dönemde kapsamınızda teklif yok.</Empty>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Program</Th>
                  <Th>Tür</Th>
                  <Th>Kontenjan</Th>
                  <Th>Başvuru</Th>
                  <Th>Kabul</Th>
                  <Th>Doluluk</Th>
                  <Th>Etkin / silinen</Th>
                </tr>
              </thead>
              <tbody>
                {r.rows.map((x) => (
                  <tr key={x.offeringId}>
                    <Td>
                      <p className="font-medium">{x.programName}</p>
                      <p className="text-xs text-su-subtle">{x.unitName}</p>
                    </Td>
                    <Td>{LABELS.track[x.type]}</Td>
                    <Td>{x.quota}</Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <span className="w-6 text-right">{x.applications}</span>
                        <span aria-hidden className="h-2 rounded-pill bg-su-primary" style={{ width: `${(x.applications / maxApps) * 80}px` }} />
                      </div>
                    </Td>
                    <Td>{x.accepted}</Td>
                    <Td>%{x.fillRate}</Td>
                    <Td>
                      {x.activeEnrollments} / {x.removedEnrollments}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </Page>
    </>
  );
}
