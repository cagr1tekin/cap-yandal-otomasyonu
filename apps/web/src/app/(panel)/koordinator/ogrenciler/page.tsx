import { ENROLLMENT_STATUSES, LABELS, TRACK_TYPES } from '@cap/contracts';
import { EnrollmentTable } from '@/components/enrollment-table';
import { buttonVariants, Card, Input, Page, PageHero, Select } from '@/components/ui';
import { api } from '@/lib/api';
import { termLabel } from '@/lib/format';
import type { EnrollmentListRow, Term } from '@/lib/types';

export const metadata = { title: 'Öğrenciler' };

/** Komisyon ve bölüm başkanı: Bilgisayar Mühendisliğinde ÇAP / yan dal yapan bütün öğrenciler. */
export default async function Students({ searchParams }: { searchParams: Promise<{ tur?: string; durum?: string; q?: string }> }) {
  const sp = await searchParams;
  const qs = new URLSearchParams({ ...(sp.tur ? { type: sp.tur } : {}), ...(sp.durum ? { status: sp.durum } : {}), ...(sp.q ? { q: sp.q } : {}) });
  const d = await api<{ currentTerm: Term | null; items: EnrollmentListRow[] }>(`/enrollments?${qs}`);
  return (
    <>
      <PageHero
        title="Öğrenciler"
        crumbs={['Kayıtlı öğrenciler', d.currentTerm ? termLabel(d.currentTerm) : '']}
        subtitle="Kesin kaydı yapılmış çift ana dal ve yan dal öğrencileri. Protokol, ders kayıt formu, not girişi, muafiyet ve dönem beyanı öğrencinin kayıt sayfasındadır."
      />
      <Page>
        <Card className="p-4">
          <form className="flex flex-wrap items-end gap-3" role="search">
            <label className="text-sm">
              <span className="mb-1 block font-medium">Öğrenci</span>
              <Input name="q" defaultValue={sp.q ?? ''} placeholder="Numara ya da ad" className="w-48" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Tür</span>
              <Select name="tur" defaultValue={sp.tur ?? ''} className="w-40">
                <option value="">Tümü</option>
                {TRACK_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {LABELS.track[t]}
                  </option>
                ))}
              </Select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Durum</span>
              <Select name="durum" defaultValue={sp.durum ?? ''} className="w-52">
                <option value="">Tümü</option>
                {ENROLLMENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {LABELS.enrollment[s]}
                  </option>
                ))}
              </Select>
            </label>
            <button className={buttonVariants({ variant: 'outline' })}>Süz</button>
          </form>
        </Card>
        <Card>
          <EnrollmentTable rows={d.items} empty="Bu süzgece uyan kayıt yok." />
        </Card>
      </Page>
    </>
  );
}
