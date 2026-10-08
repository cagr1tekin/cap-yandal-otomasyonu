import Link from 'next/link';
import { ActionForm, SubmitButton } from '@/components/forms';
import { Badge, Card, CardTitle, Empty, Field, Page, PageHero, Select, Table, Td, Th } from '@/components/ui';
import { api } from '@/lib/api';
import { fmtDateTime, termLabel } from '@/lib/format';
import { startScanAction } from '@/lib/staff-actions';
import type { Me, Term } from '@/lib/types';

export const metadata = { title: 'Dönem sonu taramaları' };

interface Scan {
  id: string;
  status: 'QUEUED' | 'RUNNING' | 'DONE' | 'FAILED';
  unitId: string | null;
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
  const [scans, terms, me] = await Promise.all([api<Scan[]>('/scans'), api<Term[]>('/terms'), api<Me>('/me')]);
  const current = terms.find((t) => t.isCurrent);
  const units = await api<{ id: string; name: string }[]>('/units');
  const isOidb = me.roles.includes('OIDB');
  const unitName = (id: string | null) => (id ? (units.find((u) => u.id === id)?.name ?? id) : 'Tüm birimler');

  return (
    <>
      <PageHero
        title="Dönem sonu taramaları"
        crumbs={['Birim']}
        subtitle="Kayıtlı öğrenciler için dönem sonu kurallarını çalıştırır. Sistem kayıt silmez; aday listesi üretir, karar sizindir."
      />
      <Page>
        <Card>
          <CardTitle>Yeni tarama</CardTitle>
          <ActionForm action={startScanAction} className="flex flex-wrap items-end gap-3">
            <Field label="Dönem">
              <Select name="termId" defaultValue={current?.id}>
                {terms.map((t) => (
                  <option key={t.id} value={t.id}>
                    {termLabel(t)}
                  </option>
                ))}
              </Select>
            </Field>
            {isOidb ? (
              <Field label="Birim">
                <Select name="unitId" defaultValue="">
                  <option value="">Tüm birimler</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : (
              <input type="hidden" name="unitId" value={me.units[0]?.id ?? ''} />
            )}
            <SubmitButton pending="Başlatılıyor…">Taramayı başlat</SubmitButton>
          </ActionForm>
        </Card>
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
                  <Th>Kapsam</Th>
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
                    <Td>{unitName(s.unitId)}</Td>
                    <Td>{s.startedBy}</Td>
                    <Td>{statusBadge[s.status]}</Td>
                    <Td>{s._count.findings}</Td>
                    <Td>
                      <Link href={`/birim/taramalar/${s.id}`}>Aç</Link>
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
