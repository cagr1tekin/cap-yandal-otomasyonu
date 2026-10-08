import Link from 'next/link';
import { LABELS } from '@cap/contracts';
import { Badge, buttonVariants, Card, Empty, Page, PageHero } from '@/components/ui';
import { api } from '@/lib/api';
import { termLabel } from '@/lib/format';
import type { OfferingRow } from '@/lib/types';

export const metadata = { title: 'Koordinatörlük' };

export default async function Coordinator() {
  const offerings = await api<OfferingRow[]>('/offerings');
  return (
    <>
      <PageHero title="Koordinatörlük" subtitle="Koordinatörü olduğunuz çift ana dal ve yan dal programları." />
      <Page>
        {offerings.length === 0 && <Empty>Koordinatörü olduğunuz bir program yok.</Empty>}
        <div className="grid gap-4 md:grid-cols-2">
          {offerings.map((o) => (
            <Card key={o.id} className="space-y-3 p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-su-subtle">
                    {LABELS.track[o.type]} · {termLabel(o.term)}
                  </p>
                  <h2 className="text-base font-semibold">{o.program.name}</h2>
                </div>
                <Badge tone={o.status === 'PUBLISHED' ? 'ok' : 'muted'}>{o.status === 'PUBLISHED' ? 'Yayında' : o.status === 'DRAFT' ? 'Taslak' : 'Kapalı'}</Badge>
              </div>
              <p className="text-sm text-su-muted">
                Kontenjan {o.quota} · {o._count?.applications ?? 0} başvuru · {o._count?.enrollments ?? 0} kayıt
                {o.rankingLockedAt && ' · öneri kilitli'}
              </p>
              <div className="flex flex-wrap gap-2">
                <Link href={`/koordinator/${o.id}`} className={buttonVariants({ size: 'sm' })}>
                  Başvurular ve sıralama
                </Link>
                <Link href={`/koordinator/${o.id}/ogrenciler`} className={buttonVariants({ size: 'sm', variant: 'outline' })}>
                  Kayıtlı öğrenciler
                </Link>
              </div>
            </Card>
          ))}
        </div>
      </Page>
    </>
  );
}
