import Link from 'next/link';
import { LABELS } from '@cap/contracts';
import { Badge, buttonVariants, Card, Empty, Page, PageHero, Table, Td, Th } from '@/components/ui';
import { api } from '@/lib/api';
import { fmtDateTime, termLabel } from '@/lib/format';
import type { OfferingRow } from '@/lib/types';

export const metadata = { title: 'Sıralama ve karar' };

const phase = { TASLAK: 'Taslak', ONCE: 'Başvuru başlamadı', ACIK: 'Başvuru açık', KAPANDI: 'Başvuru kapandı' } as const;

export default async function ReviewIndex() {
  const offerings = await api<OfferingRow[]>('/offerings');
  return (
    <>
      <PageHero title="Sıralama ve karar" crumbs={['Başvuru süreci']} subtitle="Başvuru dönemi kapanan tekliflerde sıralama, komisyon önerisi, fakülte yönetim kurulu kararı, sonuç ilanı ve kesin kayıt." />
      <Page>
        <Card>
          {offerings.length === 0 ? (
            <Empty>Tanımlı teklif yok.</Empty>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Dönem</Th>
                  <Th>Tür</Th>
                  <Th>Kontenjan</Th>
                  <Th>Başvuru</Th>
                  <Th>Takvim</Th>
                  <Th>Sıralama</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {offerings.map((o) => (
                  <tr key={o.id}>
                    <Td>{termLabel(o.term)}</Td>
                    <Td className="font-medium">{LABELS.track[o.type]}</Td>
                    <Td>{o.quota}</Td>
                    <Td>{o._count?.applications ?? 0}</Td>
                    <Td>
                      <Badge tone={o.window.open ? 'ok' : 'muted'}>{phase[o.window.phase]}</Badge>
                    </Td>
                    <Td className="text-xs">{o.rankingLockedAt ? `Kilitli (${fmtDateTime(o.rankingLockedAt)})` : 'Açık'}</Td>
                    <Td>
                      <Link href={`/koordinator/degerlendirme/${o.id}`} className={buttonVariants({ size: 'sm', variant: 'outline' })}>
                        Aç
                      </Link>
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
