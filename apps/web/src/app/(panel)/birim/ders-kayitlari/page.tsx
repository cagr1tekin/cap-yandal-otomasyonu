import Link from 'next/link';
import { Download } from 'lucide-react';
import { LABELS } from '@cap/contracts';
import { ActionForm, SubmitButton } from '@/components/forms';
import { FormBadge } from '@/components/status';
import { buttonVariants, Card, CardTitle, Empty, Page, PageHero, Select, Table, Td, Th } from '@/components/ui';
import { api } from '@/lib/api';
import { fmtDateTime, termLabel } from '@/lib/format';
import { markEnteredAction } from '@/lib/panel-actions';
import type { CourseRegRow, Term } from '@/lib/types';

export const metadata = { title: 'Ders kayıt formları' };

/** Koordinatörün teslim ettiği formlar → OBİS'e giriş listesi (Esaslar m.4; KARARLAR K-10). */
export default async function CourseRegistrations({ searchParams }: { searchParams: Promise<{ donem?: string }> }) {
  const sp = await searchParams;
  const terms = await api<Term[]>('/terms');
  const termId = sp.donem ?? terms.find((t) => t.isCurrent)?.id ?? '';
  const rows = await api<CourseRegRow[]>(`/course-registrations?termId=${termId}`);
  const submitted = rows.filter((r) => r.status === 'SUBMITTED');
  const others = rows.filter((r) => r.status !== 'SUBMITTED');

  return (
    <>
      <PageHero
        title="Ders kayıt formları"
        crumbs={['Kayıtlı öğrenciler']}
        subtitle="Teslim edilen formlardaki dersleri OBİS'e girin, ardından girildi olarak işaretleyin. Liste CSV olarak indirilebilir."
        actions={
          submitted.length > 0 ? (
            <a href={`/api/obis-listesi?donem=${termId}`} className={buttonVariants({ variant: 'accent' })}>
              <Download aria-hidden className="size-4" /> OBİS listesi (CSV)
            </a>
          ) : null
        }
      />
      <Page>
        <form className="flex items-end gap-2">
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
          <button className={buttonVariants({ variant: 'outline' })}>Göster</button>
        </form>

        <Card>
          <CardTitle>OBİS'e girilecek ({submitted.length})</CardTitle>
          {submitted.length === 0 ? (
            <Empty>Teslim edilmiş form yok.</Empty>
          ) : (
            <ActionForm action={markEnteredAction}>
              <Table>
                <thead>
                  <tr>
                    <Th>Seç</Th>
                    <Th>Öğrenci</Th>
                    <Th>Program</Th>
                    <Th>Dersler</Th>
                    <Th>Teslim</Th>
                  </tr>
                </thead>
                <tbody>
                  {submitted.map((r) => (
                    <tr key={r.id}>
                      <Td>
                        <input type="checkbox" name="ids" value={r.id} defaultChecked aria-label={`${r.studentNo} seç`} className="size-4 accent-[var(--color-su-primary)]" />
                      </Td>
                      <Td>
                        <Link href={`/kayitlar/${r.enrollmentId}`}>{r.fullName}</Link>
                        <p className="text-xs text-su-subtle">{r.studentNo}</p>
                      </Td>
                      <Td>
                        {r.programName}
                        <p className="text-xs text-su-subtle">{LABELS.track[r.type]}</p>
                      </Td>
                      <Td className="text-xs">{r.items.map((i) => `${i.code} ${i.name}`).join(', ')}</Td>
                      <Td className="text-xs">{fmtDateTime(r.submittedAt)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              <SubmitButton>Seçilenleri OBİS'e girildi olarak işaretle</SubmitButton>
            </ActionForm>
          )}
        </Card>

        <Card>
          <CardTitle>Diğer formlar</CardTitle>
          {others.length === 0 ? (
            <Empty>Yok.</Empty>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Öğrenci</Th>
                  <Th>Program</Th>
                  <Th>Durum</Th>
                </tr>
              </thead>
              <tbody>
                {others.map((r) => (
                  <tr key={r.id}>
                    <Td>
                      <Link href={`/kayitlar/${r.enrollmentId}`}>{r.fullName}</Link>
                    </Td>
                    <Td>{r.programName}</Td>
                    <Td>
                      <FormBadge value={r.status} />
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
