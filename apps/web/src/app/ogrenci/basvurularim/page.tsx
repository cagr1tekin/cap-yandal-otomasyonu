import { ExternalLink as ExtIcon } from 'lucide-react';
import { LABELS } from '@cap/contracts';
import { ActionForm, SubmitButton } from '@/components/forms';
import { ApplicationBadge } from '@/components/status';
import { Alert, buttonVariants, Card, Empty, Page, PageHero } from '@/components/ui';
import { api } from '@/lib/api';
import { cn, fmtDate, fmtDateTime } from '@/lib/format';
import type { ExternalLink, MyApplication } from '@/lib/types';
import { withdrawApplicationAction } from '../actions';

export const metadata = { title: 'Başvurularım' };

const STEPS = [
  { key: 'SUBMITTED', label: 'Alındı' },
  { key: 'UNDER_REVIEW', label: 'Bölüm incelemesi' },
  { key: 'PROPOSED', label: 'Kurul kararı' },
  { key: 'RESULT', label: 'Sonuç' },
] as const;

function stepIndex(status: MyApplication['status']) {
  if (status === 'SUBMITTED') return 0;
  if (status === 'UNDER_REVIEW') return 1;
  if (status === 'PROPOSED') return 2;
  return 3;
}

export default async function MyApplications({ searchParams }: { searchParams: Promise<{ gonderildi?: string }> }) {
  const { gonderildi } = await searchParams;
  const [apps, links] = await Promise.all([api<MyApplication[]>('/me/applications'), api<ExternalLink[]>('/links')]);
  const obis = links.find((l) => l.key === 'obis-kayit');

  return (
    <>
      <PageHero title="Başvurularım" crumbs={['Öğrenci']} subtitle="Başvurularınızın hangi aşamada olduğunu ve sonuçlarını buradan izleyin." />
      <Page>
        {gonderildi && (
          <Alert tone="ok" title="Başvurunuz alındı.">
            Sonuç ilan edildiğinde sistem içinde ve e-posta ile bildirim alacaksınız.
          </Alert>
        )}
        {apps.length === 0 && <Empty>Henüz başvurunuz yok.</Empty>}
        {apps.map((a) => {
          const current = stepIndex(a.status);
          const withdrawn = a.status === 'WITHDRAWN';
          return (
            <Card key={a.id} className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-su-subtle">
                    {LABELS.track[a.offering.type]} · {a.offering.term}
                  </p>
                  <h2 className="text-lg font-semibold">{a.offering.programName}</h2>
                  <p className="text-sm text-su-muted">
                    {a.offering.unitName} · başvuru {fmtDateTime(a.submittedAt)} · {a.path === 'RANK' ? 'başarı sırası yolu' : 'YKS taban puan yolu'}
                  </p>
                </div>
                <ApplicationBadge value={a.status} />
              </div>

              {!withdrawn && (
                <ol className="grid grid-cols-4 gap-1" aria-label="Başvuru aşamaları">
                  {STEPS.map((s, i) => (
                    <li key={s.key} aria-current={i === current ? 'step' : undefined} className="text-center">
                      <div className={cn('h-1.5 rounded-pill', i <= current ? 'bg-su-primary' : 'bg-su-primary-soft')} />
                      <p className={cn('mt-1 text-[11px] uppercase tracking-wide', i <= current ? 'text-su-primary' : 'text-su-subtle')}>{s.label}</p>
                    </li>
                  ))}
                </ol>
              )}

              {a.result && (
                <div className="rounded-xl bg-su-bg p-4 text-sm">
                  <p>
                    Yönetim kurulu kararı <span className="font-semibold">{a.result.decisionNo}</span> ({fmtDate(a.result.decisionDate)}) · ilan{' '}
                    {fmtDateTime(a.result.publishedAt)}
                  </p>
                  {a.result.rank != null && <p className="text-su-muted">Sıranız: {a.result.rank}</p>}
                </div>
              )}

              {a.status === 'ACCEPTED' && obis && (
                <Alert tone="ok" title="Kabul edildiniz — kesin kaydınızı OBİS'te yaptırın.">
                  <a href={obis.url} target="_blank" rel="noreferrer" className={cn(buttonVariants({ size: 'sm' }), 'mt-2 no-underline')}>
                    {obis.system}: {obis.label} <ExtIcon aria-hidden className="size-3.5" />
                  </a>
                </Alert>
              )}
              {a.status === 'WAITLISTED' && <Alert tone="warn">Yedek listedesiniz. Kontenjan açılırsa bildirim alacaksınız.</Alert>}

              {a.status === 'SUBMITTED' && (
                <ActionForm action={withdrawApplicationAction}>
                  <input type="hidden" name="id" value={a.id} />
                  <SubmitButton variant="outline" size="sm" confirm="Başvurunuzu geri çekmek istediğinize emin misiniz?">
                    Başvuruyu geri çek
                  </SubmitButton>
                </ActionForm>
              )}
            </Card>
          );
        })}
      </Page>
    </>
  );
}
