import { ExternalLink as Icon } from 'lucide-react';
import { SIGNERS, LABELS } from '@cap/contracts';
import { Badge, Card, CardTitle, Page, PageHero, Table, Td, Th } from '@/components/ui';
import { api } from '@/lib/api';
import type { ExternalLink } from '@/lib/types';

export const metadata = { title: 'Yönerge ve formlar' };

const copies = { PROTOCOL: '4 nüsha', COURSE_REG: '3 nüsha', EXEMPTION: '2 nüsha' } as const;

/** Bölümün "Çift Anadal" sayfasındaki belgeler ve bu sistemdeki karşılıkları. */
export default async function Documents() {
  const links = await api<ExternalLink[]>('/links');
  const docs = links.filter((l) => l.system === 'Belge' || l.key === 'bolum-cap');
  const other = links.filter((l) => !docs.includes(l));
  return (
    <>
      <PageHero title="Yönerge ve formlar" subtitle="Bölüm sitesindeki yönetmelik, yönerge, rehber ve protokoller. Formlar bu sistemde çevrim içi doldurulur ve imzalanır." />
      <Page>
        <Card>
          <CardTitle>Belgeler</CardTitle>
          <ul className="divide-y divide-su-border/60">
            {docs.map((l) => (
              <li key={l.key} className="flex items-start justify-between gap-3 py-3">
                <div>
                  <a href={l.url} target="_blank" rel="noreferrer" className="font-medium">
                    {l.label}
                  </a>
                  <p className="text-sm text-su-muted">{l.description}</p>
                </div>
                <Icon aria-hidden className="mt-1 size-4 shrink-0 text-su-subtle" />
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardTitle>Hangi formu kim imzalar</CardTitle>
          <Table>
            <thead>
              <tr>
                <Th>Form</Th>
                <Th>İmzacılar</Th>
                <Th>Kâğıttaki karşılığı</Th>
              </tr>
            </thead>
            <tbody>
              {(['PROTOCOL', 'COURSE_REG', 'EXEMPTION'] as const).map((k) => (
                <tr key={k}>
                  <Td className="font-medium">{LABELS.subject[k]}</Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {SIGNERS[k].map((r) => (
                        <Badge key={r}>{LABELS.approvalRole[r]}</Badge>
                      ))}
                    </div>
                  </Td>
                  <Td className="text-su-muted">{copies[k]}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <p className="mt-3 text-xs text-su-muted">Kaynak: Bilgisayar Mühendisliği Çift Anadal Rehberi (Şubat 2025), “Asil öğrenci kayıtları” ve “Özel şartlı derslerin muafiyeti”.</p>
        </Card>
        <Card>
          <CardTitle>Bu sistemin dışında kalanlar</CardTitle>
          <ul className="space-y-3 text-sm">
            {other.map((l) => (
              <li key={l.key}>
                <a href={l.url} target="_blank" rel="noreferrer" className="font-medium">
                  {l.label}
                </a>{' '}
                <Badge tone="muted">{l.system}</Badge>
                <p className="text-su-muted">{l.description}</p>
              </li>
            ))}
          </ul>
        </Card>
      </Page>
    </>
  );
}
