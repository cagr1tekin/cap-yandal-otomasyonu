import { LABELS } from '@cap/contracts';
import { ApplicationView } from '@/components/application-view';
import { Alert, Page, PageHero } from '@/components/ui';
import { api } from '@/lib/api';
import type { ApplicationDetail } from '@/lib/types';

export const metadata = { title: 'Başvurum' };

export default async function MyApplication({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ gonderildi?: string }> }) {
  const [{ id }, { gonderildi }] = await Promise.all([params, searchParams]);
  const a = await api<ApplicationDetail>(`/applications/${id}`);
  return (
    <>
      <PageHero title={`${LABELS.track[a.offering.type]} başvurum`} crumbs={['Öğrenci', 'Başvuru']} subtitle="Başvurunuzun durumu, beyanınız ve kural değerlendirmesi." />
      <Page>
        {gonderildi &&
          (a.status === 'INELIGIBLE' ? (
            <Alert tone="warn" title="Başvuru kayda alındı: koşulları sağlamıyor.">
              Aşağıdaki kural değerlendirmesinde sağlanmayan koşulları görebilirsiniz.
            </Alert>
          ) : (
            <Alert tone="ok" title="Başvurunuz alındı.">
              Komisyon beyanınızı belgelerinizle karşılaştıracak. Sonuç ilan edildiğinde bildirim alırsınız.
            </Alert>
          ))}
        <ApplicationView a={a} staff={false} />
      </Page>
    </>
  );
}
