import Link from 'next/link';
import { LABELS } from '@cap/contracts';
import { ActionForm, SubmitButton } from '@/components/forms';
import { FormBadge } from '@/components/status';
import { Card, Empty, Page, PageHero, Table, Td, Th } from '@/components/ui';
import { api } from '@/lib/api';
import { termLabel } from '@/lib/format';
import { getMe } from '@/lib/me';
import { submitBatchAction } from '@/lib/panel-actions';
import type { CourseRegRow } from '@/lib/types';

export const metadata = { title: 'Toplu teslim' };

/** Esaslar m.4: "Ders kayıt formları toplu halde, koordinatör tarafından ... öğrenci işleri bürosuna teslim edilir." */
export default async function BatchSubmit() {
  const me = await getMe();
  const term = me?.currentTerm;
  const rows = term ? await api<CourseRegRow[]>(`/course-registrations?termId=${term.id}`) : [];
  const approved = rows.filter((r) => r.status === 'APPROVED');

  return (
    <>
      <PageHero
        title="Ders kayıt formlarını toplu teslim"
        crumbs={['Koordinatörlük', term ? termLabel(term) : '']}
        subtitle="İmzaları tamamlanan formlar öğrenci işlerine tek seferde teslim edilir; öğrenci işleri dersleri OBİS'e girer."
      />
      <Page>
        <Card>
          {rows.length === 0 ? (
            <Empty>Bu dönem için ders kayıt formu yok.</Empty>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Öğrenci</Th>
                  <Th>Program</Th>
                  <Th>Ders</Th>
                  <Th>Durum</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <Td>
                      <Link href={`/kayitlar/${r.enrollmentId}`}>{r.fullName}</Link>
                      <p className="text-xs text-su-subtle">{r.studentNo}</p>
                    </Td>
                    <Td>
                      {r.programName}
                      <p className="text-xs text-su-subtle">{LABELS.track[r.type]}</p>
                    </Td>
                    <Td>
                      {r.items.length} ders · {r.items.reduce((t, i) => t + i.ects, 0)} AKTS
                    </Td>
                    <Td>
                      <FormBadge value={r.status} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
          {term && (
            <ActionForm action={submitBatchAction} className="mt-4">
              <input type="hidden" name="termId" value={term.id} />
              <SubmitButton disabled={approved.length === 0} confirm={`${approved.length} onaylı form öğrenci işlerine teslim edilecek. Devam edilsin mi?`}>
                Onaylı {approved.length} formu teslim et
              </SubmitButton>
            </ActionForm>
          )}
        </Card>
      </Page>
    </>
  );
}
