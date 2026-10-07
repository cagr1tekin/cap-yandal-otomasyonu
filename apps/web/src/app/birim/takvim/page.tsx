import { LABELS, type TrackType } from '@cap/contracts';
import { ActionForm, SubmitButton } from '@/components/forms';
import { Badge, Card, Empty, Field, Input, Page, PageHero } from '@/components/ui';
import { api } from '@/lib/api';
import { fmtDateTime, termLabel, toLocalInput } from '@/lib/format';
import { closeWindowAction, windowAction } from '@/lib/staff-actions';
import type { Term } from '@/lib/types';

export const metadata = { title: 'Başvuru takvimi' };

interface Win {
  id: string;
  unitId: string;
  termId: string;
  type: TrackType;
  opensAt: string;
  closesAt: string;
  announceAt: string | null;
  unit: { name: string };
}

function phase(w: Win) {
  const now = Date.now();
  if (now < new Date(w.opensAt).getTime()) return <Badge tone="muted">Açılmadı</Badge>;
  if (now > new Date(w.closesAt).getTime()) return <Badge tone="neutral">Kapandı</Badge>;
  return <Badge tone="ok">Açık</Badge>;
}

export default async function Calendar() {
  const terms = await api<Term[]>('/terms');
  const term = terms.find((t) => t.isCurrent) ?? terms[0];
  const windows = await api<Win[]>(`/windows?termId=${term.id}`);

  return (
    <>
      <PageHero title="Başvuru takvimi" crumbs={['Birim', termLabel(term)]} subtitle="Birim bazında başvuru açılış, kapanış ve ilan tarihleri (Europe/Istanbul)." />
      <Page>
        {windows.length === 0 && <Empty>Takvim tanımlı değil.</Empty>}
        <div className="grid gap-4 lg:grid-cols-2">
          {windows.map((w) => (
            <Card key={w.id} className="space-y-3 p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-su-subtle">{LABELS.track[w.type]}</p>
                  <h2 className="text-base font-semibold">{w.unit.name}</h2>
                  <p className="text-xs text-su-muted">
                    {fmtDateTime(w.opensAt)} – {fmtDateTime(w.closesAt)}
                  </p>
                </div>
                {phase(w)}
              </div>
              <ActionForm action={windowAction}>
                <input type="hidden" name="unitId" value={w.unitId} />
                <input type="hidden" name="termId" value={w.termId} />
                <input type="hidden" name="type" value={w.type} />
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Açılış">
                    <Input type="datetime-local" name="opensAt" defaultValue={toLocalInput(w.opensAt)} required />
                  </Field>
                  <Field label="Kapanış">
                    <Input type="datetime-local" name="closesAt" defaultValue={toLocalInput(w.closesAt)} required />
                  </Field>
                  <Field label="İlan">
                    <Input type="datetime-local" name="announceAt" defaultValue={w.announceAt ? toLocalInput(w.announceAt) : ''} />
                  </Field>
                </div>
                <SubmitButton size="sm" variant="outline">
                  Kaydet
                </SubmitButton>
              </ActionForm>
              <ActionForm action={closeWindowAction}>
                <input type="hidden" name="unitId" value={w.unitId} />
                <input type="hidden" name="termId" value={w.termId} />
                <input type="hidden" name="type" value={w.type} />
                <SubmitButton
                  size="sm"
                  variant="ghost"
                  disabled={Date.now() >= new Date(w.closesAt).getTime()}
                  confirm="Başvuru dönemi şimdi kapatılsın mı? Öğrenciler artık başvuramaz."
                >
                  Başvuruyu şimdi kapat
                </SubmitButton>
              </ActionForm>
            </Card>
          ))}
        </div>
      </Page>
    </>
  );
}
