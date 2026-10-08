import { ApplicationView } from '@/components/application-view';
import { Page, PageHero } from '@/components/ui';
import { api } from '@/lib/api';
import type { ApplicationDetail } from '@/lib/types';

export const metadata = { title: 'Başvuru' };

/** Komisyon: öğrencinin beyanını yüklediği belgelerle karşılaştırır. */
export default async function ApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await api<ApplicationDetail>(`/applications/${id}`);
  return (
    <>
      <PageHero
        title="Başvuru ve beyan doğrulama"
        crumbs={['Başvuru süreci', 'Başvurular']}
        subtitle="Öğrencinin kendi girdiği bilgileri yüklediği belgelerle karşılaştırın. Doğrulanmayan başvuru sıralamaya alınamaz."
      />
      <Page>
        <ApplicationView a={a} staff />
      </Page>
    </>
  );
}
