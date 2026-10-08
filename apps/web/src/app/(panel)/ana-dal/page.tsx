import { EnrollmentTable } from '@/components/enrollment-table';
import { Card, Page, PageHero } from '@/components/ui';
import { api } from '@/lib/api';
import { getMe } from '@/lib/me';
import type { EnrollmentListRow, Term } from '@/lib/types';

export const metadata = { title: 'Bölümümün öğrencileri' };

/** Ana dal danışmanı ve ana dal bölüm başkanı: kendi bölümünden Bilgisayar Müh. ÇAP / yan dal yapan öğrenciler. */
export default async function MainDepartment() {
  const [d, me] = await Promise.all([api<{ currentTerm: Term | null; items: EnrollmentListRow[] }>('/main-department/students'), getMe()]);
  const scope = me?.programs.filter((p) => p.id !== me.home.id).map((p) => p.name).join(', ');
  return (
    <>
      <PageHero
        title="Bölümümün öğrencileri"
        crumbs={['Ana dal bölümü', scope ?? '']}
        subtitle="Danışmanı ya da bölüm başkanı olduğunuz öğrencilerin Bilgisayar Mühendisliği çift ana dal / yan dal kayıtları. Bu kayıtları görebilir ve formlarını imzalayabilirsiniz."
      />
      <Page>
        <Card>
          <EnrollmentTable rows={d.items} empty="Bölümünüzden kayıtlı öğrenci yok." />
        </Card>
      </Page>
    </>
  );
}
