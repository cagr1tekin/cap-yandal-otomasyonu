import { ExternalLink as Icon } from 'lucide-react';
import { SIGNERS_NOTE } from '@cap/contracts';
import { Badge, Card, CardTitle, Page, PageHero, Table, Td, Th } from '@/components/ui';
import { api } from '@/lib/api';
import type { ExternalLink } from '@/lib/types';

export const metadata = { title: 'Yönerge ve formlar' };

const FORMS = [
  ['Kabul ve Ders Protokolü', 'Öğrenci, ana dal danışmanı, ana dal bölüm başkanı, ÇAP / YDP koordinatörü, ÇAP / YDP bölüm başkanı', '4 nüsha', 'Bir kez, kabulden sonra'],
  ['Ders kayıt formu (FORM01)', 'Öğrenci, ana dal danışmanı, ÇAP / YDP koordinatörü', '3 nüsha', 'Her dönem'],
  ['Özel şartlı derslerin muafiyeti formu', 'Öğrenci, ana dal danışmanı, ÇAP koordinatörü', '2 nüsha', 'Mezuniyetten önce, gerekirse'],
  ['ÇAP / YDP not belgesi (transkript)', '—', '—', 'Her dönem sonu (zorunlu)'],
] as const;

/** Bölümün "Çift Anadal" sayfasındaki belgeler ve sistemde yüklenecek formlar. */
export default async function Documents() {
  const links = await api<ExternalLink[]>('/links');
  const docs = links.filter((l) => l.system === 'Belge' || l.key === 'bolum-cap');
  const other = links.filter((l) => !docs.includes(l));
  return (
    <>
      <PageHero title="Yönerge ve formlar" subtitle="Bölüm sitesindeki yönetmelik, yönerge, rehber ve protokoller. Yönerge ile sistem çelişirse yönerge esastır." />
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
          <CardTitle>
            Sisteme yüklenecek formlar
            <span className="block text-xs font-normal text-su-muted">{SIGNERS_NOTE}</span>
          </CardTitle>
          <Table>
            <thead>
              <tr>
                <Th>Form</Th>
                <Th>İmzalar (kâğıtta)</Th>
                <Th>Nüsha</Th>
                <Th>Ne zaman</Th>
              </tr>
            </thead>
            <tbody>
              {FORMS.map(([name, signers, copies, when]) => (
                <tr key={name}>
                  <Td className="font-medium">{name}</Td>
                  <Td className="text-xs">{signers}</Td>
                  <Td>{copies}</Td>
                  <Td className="text-xs">{when}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <p className="mt-3 text-xs text-su-muted">Kaynak: Bilgisayar Mühendisliği Çift Anadal Rehberi (Şubat 2025) ve koordinatörün sistem çerçevesi.</p>
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
