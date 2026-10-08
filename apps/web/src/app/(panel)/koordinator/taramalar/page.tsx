import Link from 'next/link';
import { ActionForm, SubmitButton } from '@/components/forms';
import { Badge, Card, CardTitle, Empty, Field, Page, PageHero, Select, Table, Td, Th } from '@/components/ui';
import { api } from '@/lib/api';
import { fmtDateTime, termLabel } from '@/lib/format';
import { startScanAction } from '@/lib/actions';
import { getMe, hasRole } from '@/lib/me';
import type { Term } from '@/lib/types';

export const metadata = { title: 'Dönem sonu taramaları' };

interface Scan {
  id: string;
  status: 'QUEUED' | 'RUNNING' | 'DONE' | 'FAILED';
  startedBy: string;
  createdAt: string;
  finishedAt: string | null;
  term: Term;
  _count: { findings: number };
}

const statusBadge = {
  QUEUED: <Badge tone="muted">Sırada</Badge>,
  RUNNING: <Badge tone="warn">Çalışıyor</Badge>,
  DONE: <Badge tone="ok">Tamamlandı</Badge>,
  FAILED: <Badge tone="bad">Hata</Badge>,
};

export default async function Scans() {
  const [scans, terms, me] = await Promise.all([api<Scan[]>('/scans'), api<(Term & { startsAt: string })[]>('/terms'), getMe()]);
  // Dönem sonu taraması başlamış dönemler için yapılır; varsayılan, son biten dönemdir.
  const started = terms.filter((t) => new Date(t.startsAt) <= new Date());
  const current = started.at(-2) ?? started.at(-1);
  const canStart = hasRole(me, 'KOORDINATOR');

  return (
    <>
      <PageHero
        title="Dönem sonu taramaları"
        crumbs={['Kayıtlı öğrenciler']}
        subtitle="Dönem beyanları, ders kayıt formları ve girilen notlarla dönem sonu kurallarını çalıştırır. Sistem kayıt silmez; aday listesi üretir, kararı komisyon verir."
      />
      <Page>
        {canStart && (
        <Card>
          <CardTitle>Yeni tarama</CardTitle>
          <ActionForm action={startScanAction} className="flex flex-wrap items-end gap-3">
            <Field label="Dönem">
              <Select name="termId" defaultValue={current?.id}>
                {started.map((t) => (
                  <option key={t.id} value={t.id}>
                    {termLabel(t)}
                  </option>
                ))}
              </Select>
            </Field>
            <SubmitButton pending="Başlatılıyor…">Taramayı başlat</SubmitButton>
          </ActionForm>
        </Card>
        )}
        <Card>
          <CardTitle>Geçmiş taramalar</CardTitle>
          {scans.length === 0 ? (
            <Empty>Henüz tarama yapılmadı.</Empty>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Başlangıç</Th>
                  <Th>Dönem</Th>
                  <Th>Başlatan</Th>
                  <Th>Durum</Th>
                  <Th>Bulgu</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {scans.map((s) => (
                  <tr key={s.id}>
                    <Td>{fmtDateTime(s.createdAt)}</Td>
                    <Td>{termLabel(s.term)}</Td>
                    <Td>{s.startedBy}</Td>
                    <Td>{statusBadge[s.status]}</Td>
                    <Td>{s._count.findings}</Td>
                    <Td>
                      <Link href={`/koordinator/taramalar/${s.id}`}>Aç</Link>
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
