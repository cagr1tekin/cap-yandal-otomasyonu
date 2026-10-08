import Link from 'next/link';
import { LABELS } from '@cap/contracts';
import { Badge, Card, Empty, Page, PageHero, Table, Td, Th } from '@/components/ui';
import { api } from '@/lib/api';
import type { Decision, OfferingRow } from '@/lib/types';

export const metadata = { title: 'Kararlar' };

type Row = OfferingRow & { decision: Decision | null; counts: Record<string, number> };

function stage(o: Row) {
  if (o.registrationClosedAt) return <Badge tone="muted">Kayıt dönemi kapandı</Badge>;
  if (o.decision?.publishedAt) return <Badge tone="ok">Yayımlandı</Badge>;
  if (o.decision) return <Badge tone="warn">Karar girildi, yayım bekliyor</Badge>;
  if (o.rankingLockedAt) return <Badge tone="accent">Karar bekliyor</Badge>;
  return <Badge tone="neutral">Bölüm incelemesi</Badge>;
}

export default async function Decisions() {
  const rows = await api<Row[]>('/decisions');
  const waiting = rows.filter((r) => r.rankingLockedAt && !r.decision);
  return (
    <>
      <PageHero title="Kurul kararları ve sonuçlar" crumbs={['Birim']} subtitle={`${waiting.length} teklif için yönetim kurulu kararı bekleniyor.`} />
      <Page>
        <Card>
          {rows.length === 0 ? (
            <Empty>Teklif yok.</Empty>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Program</Th>
                  <Th>Tür</Th>
                  <Th>Kontenjan</Th>
                  <Th>Başvuru</Th>
                  <Th>Aşama</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => {
                  const total = Object.entries(o.counts)
                    .filter(([k]) => k !== 'WITHDRAWN')
                    .reduce((t, [, v]) => t + v, 0);
                  return (
                    <tr key={o.id}>
                      <Td>
                        <p className="font-medium">{o.program.name}</p>
                        <p className="text-xs text-su-subtle">{o.program.unit.name}</p>
                      </Td>
                      <Td>{LABELS.track[o.type]}</Td>
                      <Td>{o.quota}</Td>
                      <Td>{total}</Td>
                      <Td>{stage(o)}</Td>
                      <Td>
                        <Link href={`/birim/kararlar/${o.id}`}>Aç</Link>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card>
      </Page>
    </>
  );
}
