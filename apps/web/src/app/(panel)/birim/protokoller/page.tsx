import Link from 'next/link';
import { FORM_STATUSES, LABELS } from '@cap/contracts';
import { FormBadge } from '@/components/status';
import { buttonVariants, Card, Empty, Page, PageHero, Select, Table, Td, Th } from '@/components/ui';
import { api } from '@/lib/api';
import { fmtDateTime } from '@/lib/format';
import type { ProtocolRow } from '@/lib/types';

export const metadata = { title: 'Protokoller' };

export default async function Protocols({ searchParams }: { searchParams: Promise<{ durum?: string }> }) {
  const sp = await searchParams;
  const status = sp.durum ?? 'APPROVED';
  const rows = await api<ProtocolRow[]>(`/protocols${status ? `?status=${status}` : ''}`);
  return (
    <>
      <PageHero
        title="Kabul ve Ders Protokolleri"
        crumbs={['Kayıtlı öğrenciler']}
        subtitle="İmzaları tamamlanan protokollerin aslı öğrenci dosyasına kaldırılır (İİBF ilkeleri). Varsayılan görünüm: dosyalanmayı bekleyenler."
      />
      <Page>
        <form className="flex items-end gap-2">
          <label className="text-sm">
            <span className="mb-1 block font-medium">Durum</span>
            <Select name="durum" defaultValue={status}>
              <option value="">Tümü</option>
              {FORM_STATUSES.filter((s) => s !== 'SUBMITTED' && s !== 'ENTERED').map((s) => (
                <option key={s} value={s}>
                  {LABELS.form[s]}
                </option>
              ))}
            </Select>
          </label>
          <button className={buttonVariants({ variant: 'outline' })}>Göster</button>
        </form>
        <Card>
          {rows.length === 0 ? (
            <Empty>Kayıt yok.</Empty>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Öğrenci</Th>
                  <Th>Program</Th>
                  <Th>AKTS</Th>
                  <Th>Durum</Th>
                  <Th>Son değişiklik</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id}>
                    <Td>
                      <Link href={`/kayitlar/${p.enrollmentId}`} className="font-medium">
                        {p.fullName}
                      </Link>
                      <p className="text-xs text-su-subtle">{p.studentNo}</p>
                    </Td>
                    <Td>
                      {p.programName}
                      <p className="text-xs text-su-subtle">
                        {LABELS.track[p.type]} · {p.unitName}
                      </p>
                    </Td>
                    <Td>{p.ects}</Td>
                    <Td>
                      <FormBadge value={p.status} /> <span className="text-xs text-su-subtle">{p.round}. tur</span>
                    </Td>
                    <Td className="text-xs">{fmtDateTime(p.updatedAt)}</Td>
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
