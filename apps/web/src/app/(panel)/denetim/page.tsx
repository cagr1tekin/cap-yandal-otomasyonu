import { buttonVariants, Card, Empty, Input, Page, PageHero, Table, Td, Th } from '@/components/ui';
import { api } from '@/lib/api';
import { fmtDateTime } from '@/lib/format';
import type { AuditRow } from '@/lib/types';

export const metadata = { title: 'Denetim kaydı' };

/** Değiştirilemez denetim kaydı (veritabanı tetikleyicisiyle korunur). */
export default async function Audit({ searchParams }: { searchParams: Promise<{ kim?: string; islem?: string; varlik?: string; ogrenci?: string }> }) {
  const sp = await searchParams;
  const qs = new URLSearchParams({ take: '300', ...(sp.kim ? { actor: sp.kim } : {}), ...(sp.islem ? { action: sp.islem } : {}), ...(sp.varlik ? { entity: sp.varlik } : {}), ...(sp.ogrenci ? { studentNo: sp.ogrenci } : {}) });
  const rows = await api<AuditRow[]>(`/audit?${qs}`);
  const short = (v: unknown) => {
    if (v == null) return '';
    const s = JSON.stringify(v);
    return s.length > 140 ? `${s.slice(0, 140)}…` : s;
  };

  return (
    <>
      <PageHero
        title="Denetim kaydı"
        crumbs={['Yönetim']}
        subtitle="Kim, ne zaman, neyi, eski ve yeni değeriyle ne yaptı. Kayıtlar yalnızca eklenir; veritabanı düzeyinde değiştirilemez ve silinemez. Bölüm başkanı bu kaydı görür."
      />
      <Page>
        <Card className="p-4">
          <form className="flex flex-wrap items-end gap-3" role="search">
            <label className="text-sm">
              <span className="mb-1 block font-medium">Kişi</span>
              <Input name="kim" defaultValue={sp.kim ?? ''} className="w-44" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">İşlem</span>
              <Input name="islem" defaultValue={sp.islem ?? ''} placeholder="ATTEMPT, DOCUMENT…" className="w-52" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Varlık</span>
              <Input name="varlik" defaultValue={sp.varlik ?? ''} placeholder="CourseAttempt, Document…" className="w-52" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Öğrenci no</span>
              <Input name="ogrenci" defaultValue={sp.ogrenci ?? ''} className="w-36" />
            </label>
            <button className={buttonVariants({ variant: 'outline' })}>Süz</button>
          </form>
        </Card>
        <Card>
          {rows.length === 0 ? (
            <Empty>Kayıt yok.</Empty>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Zaman</Th>
                  <Th>Kişi</Th>
                  <Th>İşlem</Th>
                  <Th>Varlık</Th>
                  <Th>Ayrıntı</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <Td className="whitespace-nowrap text-xs">{fmtDateTime(r.at)}</Td>
                    <Td className="text-xs">
                      {r.actor}
                      {r.studentNo && <span className="block text-su-subtle">öğrenci {r.studentNo}</span>}
                    </Td>
                    <Td className="font-mono text-xs">{r.action}</Td>
                    <Td className="text-xs">
                      {r.entity}
                      <span className="block text-su-subtle">{r.entityId.slice(0, 18)}</span>
                    </Td>
                    <Td className="max-w-md break-all font-mono text-[11px] text-su-muted">
                      {r.reason && <span className="block font-sans text-xs text-su-text">Gerekçe: {r.reason}</span>}
                      {r.before != null && <span className="block">önce: {short(r.before)}</span>}
                      {r.after != null && <span className="block">sonra: {short(r.after)}</span>}
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
