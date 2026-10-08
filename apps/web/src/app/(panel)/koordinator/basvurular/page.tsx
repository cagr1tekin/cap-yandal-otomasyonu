import Link from 'next/link';
import { APPLICATION_STATUSES, LABELS, VERIFICATION_STATUSES } from '@cap/contracts';
import { ApplicationBadge } from '@/components/status';
import { Badge, buttonVariants, Card, Empty, Input, Page, PageHero, Select, Table, Td, Th } from '@/components/ui';
import { api } from '@/lib/api';
import { fmtDateTime, fmtGpa, termLabel } from '@/lib/format';
import type { ApplicationListRow } from '@/lib/types';

export const metadata = { title: 'Başvurular' };

const verificationTone = { PENDING: 'warn', VERIFIED: 'ok', MISMATCH: 'bad' } as const;

export default async function Applications({ searchParams }: { searchParams: Promise<{ durum?: string; dogrulama?: string; q?: string }> }) {
  const sp = await searchParams;
  const qs = new URLSearchParams({ ...(sp.durum ? { status: sp.durum } : {}), ...(sp.dogrulama ? { verification: sp.dogrulama } : {}), ...(sp.q ? { q: sp.q } : {}) });
  const rows = await api<ApplicationListRow[]>(`/applications?${qs}`);
  const term = rows[0]?.offering.term;

  return (
    <>
      <PageHero
        title="Başvurular"
        crumbs={['Başvuru süreci', term ? termLabel(term) : '']}
        subtitle="Öğrencilerin çevrim içi yaptığı başvurular. Her başvurunun beyanı, yüklenen belgelerle karşılaştırılıp doğrulanır."
      />
      <Page>
        <Card className="p-4">
          <form className="flex flex-wrap items-end gap-3" role="search">
            <label className="text-sm">
              <span className="mb-1 block font-medium">Öğrenci</span>
              <Input name="q" defaultValue={sp.q ?? ''} placeholder="Numara ya da ad" className="w-48" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Durum</span>
              <Select name="durum" defaultValue={sp.durum ?? ''} className="w-52">
                <option value="">Tümü</option>
                {APPLICATION_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {LABELS.application[s]}
                  </option>
                ))}
              </Select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Beyan</span>
              <Select name="dogrulama" defaultValue={sp.dogrulama ?? ''} className="w-52">
                <option value="">Tümü</option>
                {VERIFICATION_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {LABELS.verification[s]}
                  </option>
                ))}
              </Select>
            </label>
            <button className={buttonVariants({ variant: 'outline' })}>Süz</button>
          </form>
        </Card>
        <Card>
          {rows.length === 0 ? (
            <Empty>Bu süzgece uyan başvuru yok.</Empty>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Öğrenci</Th>
                  <Th>Ana dal</Th>
                  <Th>Tür</Th>
                  <Th>GNO (beyan)</Th>
                  <Th>Durum</Th>
                  <Th>Beyan</Th>
                  <Th>Başvuru</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id}>
                    <Td>
                      <Link href={`/koordinator/basvurular/${a.id}`} className="font-medium">
                        {a.fullName}
                      </Link>
                      <span className="block text-xs text-su-subtle">{a.studentNo}</span>
                    </Td>
                    <Td>{a.mainProgramName}</Td>
                    <Td>{LABELS.track[a.offering.type]}</Td>
                    <Td>{fmtGpa(a.gano)}</Td>
                    <Td>
                      <ApplicationBadge value={a.status} />
                    </Td>
                    <Td>
                      <Badge tone={verificationTone[a.verification]}>{LABELS.verification[a.verification]}</Badge>
                    </Td>
                    <Td className="text-xs">{fmtDateTime(a.submittedAt)}</Td>
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
