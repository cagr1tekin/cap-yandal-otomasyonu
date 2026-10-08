import Link from 'next/link';
import { Plus } from 'lucide-react';
import { APPLICATION_STATUSES, LABELS } from '@cap/contracts';
import { ApplicationBadge } from '@/components/status';
import { buttonVariants, Card, Empty, Input, Page, PageHero, Select, Table, Td, Th } from '@/components/ui';
import { api } from '@/lib/api';
import { fmtDate, termLabel } from '@/lib/format';
import type { ApplicationListRow, Term } from '@/lib/types';

export const metadata = { title: 'Başvurular' };

export default async function Applications({ searchParams }: { searchParams: Promise<{ donem?: string; durum?: string; no?: string }> }) {
  const sp = await searchParams;
  const terms = await api<Term[]>('/terms');
  const termId = sp.donem ?? terms.find((t) => t.isCurrent)?.id ?? '';
  const qs = new URLSearchParams({ termId, ...(sp.durum ? { status: sp.durum } : {}), ...(sp.no ? { studentNo: sp.no } : {}) });
  const rows = await api<ApplicationListRow[]>(`/applications?${qs}`);
  const counts = APPLICATION_STATUSES.map((s) => [s, rows.filter((r) => r.status === s).length] as const).filter(([, n]) => n > 0);

  return (
    <>
      <PageHero
        title="Başvurular"
        crumbs={['Başvuru süreci']}
        subtitle="Birime şahsen verilen dilekçelerin kayıtları. Yeni dilekçeyi öğrenci numarasıyla girin; uygunluk ve zorunlu belgeler OBİS verisiyle denetlenir."
        actions={
          <Link href="/birim/basvurular/yeni" className={buttonVariants({ variant: 'accent' })}>
            <Plus aria-hidden className="size-4" /> Yeni başvuru girişi
          </Link>
        }
      />
      <Page>
        <Card className="p-4">
          <form className="flex flex-wrap items-end gap-3" role="search">
            <label className="text-sm">
              <span className="mb-1 block font-medium">Dönem</span>
              <Select name="donem" defaultValue={termId}>
                {terms.map((t) => (
                  <option key={t.id} value={t.id}>
                    {termLabel(t)}
                  </option>
                ))}
              </Select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Durum</span>
              <Select name="durum" defaultValue={sp.durum ?? ''}>
                <option value="">Tümü</option>
                {APPLICATION_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {LABELS.application[s]}
                  </option>
                ))}
              </Select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Öğrenci no</span>
              <Input name="no" defaultValue={sp.no ?? ''} inputMode="numeric" className="w-40" />
            </label>
            <button className={buttonVariants({ variant: 'outline', size: 'md' })}>Süz</button>
          </form>
          <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-su-muted">
            {counts.map(([s, n]) => (
              <span key={s}>
                {LABELS.application[s]}: <b>{n}</b>
              </span>
            ))}
          </p>
        </Card>
        <Card>
          {rows.length === 0 ? (
            <Empty>Kayıt yok.</Empty>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Evrak</Th>
                  <Th>Öğrenci</Th>
                  <Th>Program</Th>
                  <Th>Yol</Th>
                  <Th>Durum</Th>
                  <Th>Giren</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <Td>
                      <Link href={`/birim/basvurular/${r.id}`} className="font-medium">
                        {r.documentNo ?? '—'}
                      </Link>
                      <p className="text-xs text-su-subtle">{fmtDate(r.documentDate)}</p>
                    </Td>
                    <Td>
                      {r.fullName}
                      <p className="text-xs text-su-subtle">{r.studentNo}</p>
                    </Td>
                    <Td>
                      {r.offering.programName}
                      <p className="text-xs text-su-subtle">{LABELS.track[r.offering.type]}</p>
                    </Td>
                    <Td>{r.path === 'RANK' ? 'Başarı sırası' : 'YKS taban puan'}</Td>
                    <Td>
                      <ApplicationBadge value={r.status} />
                    </Td>
                    <Td className="text-xs text-su-muted">{r.enteredBy}</Td>
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
