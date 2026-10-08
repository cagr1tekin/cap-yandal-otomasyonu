import Link from 'next/link';
import { LABELS, TRACK_TYPES } from '@cap/contracts';
import { ActionForm, SubmitButton } from '@/components/forms';
import { Badge, buttonVariants, Card, CardTitle, Empty, Field, Input, Page, PageHero, Select, Textarea } from '@/components/ui';
import { api } from '@/lib/api';
import { cn, termLabel } from '@/lib/format';
import { createOfferingAction, updateOfferingAction } from '@/lib/staff-actions';
import type { Me, OfferingRow, Program, Term } from '@/lib/types';

export const metadata = { title: 'Teklifler' };

const statusTone = { PUBLISHED: 'ok', DRAFT: 'muted', CLOSED: 'neutral' } as const;
const statusLabel = { PUBLISHED: 'Yayında', DRAFT: 'Taslak', CLOSED: 'Kapalı' } as const;

function OfferingEditor({ o }: { o: OfferingRow }) {
  return (
    <details className="rounded-lg bg-su-bg px-3 py-2">
      <summary className="text-sm font-medium text-su-primary">Düzenle</summary>
      <ActionForm action={updateOfferingAction} className="mt-3">
        <input type="hidden" name="offeringId" value={o.id} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Kontenjan">
            <Input name="quota" type="number" min={1} defaultValue={o.quota} required />
          </Field>
          <Field label="1. sınıf mevcudu" hint="Asgari kontenjan denetimi (KR-ÇAP-09)">
            <Input name="firstYearIntake" type="number" min={1} defaultValue={o.firstYearIntake ?? ''} />
          </Field>
          <Field label="Koordinatör (kullanıcı adı)">
            <Input name="coordinatorUsername" defaultValue={o.coordinatorUsername} required />
          </Field>
          <Field label="Durum">
            <Select name="status" defaultValue={o.status}>
              <option value="DRAFT">Taslak</option>
              <option value="PUBLISHED">Yayında</option>
              <option value="CLOSED">Kapalı</option>
            </Select>
          </Field>
        </div>
        <Field label="Kontenjan gerekçesi" hint="Asgari kontenjanın altında yayımlamak için zorunlu.">
          <Textarea name="quotaJustification" defaultValue={o.quotaJustification ?? ''} />
        </Field>
        <SubmitButton size="sm">Kaydet</SubmitButton>
      </ActionForm>
    </details>
  );
}

export default async function Offerings({ searchParams }: { searchParams: Promise<{ donem?: string }> }) {
  const { donem } = await searchParams;
  const [terms, me, programs] = await Promise.all([api<Term[]>('/terms'), api<Me>('/me'), api<Program[]>('/programs')]);
  const termId = donem ?? terms.find((t) => t.isCurrent)?.id ?? terms[0]?.id;
  const offerings = await api<OfferingRow[]>(`/offerings?termId=${termId}`);
  const isOidb = me.roles.includes('OIDB');
  const myUnits = new Set(me.units.map((u) => u.id));
  const myPrograms = new Set(me.programs.map((p) => p.id));
  const manageable = programs.filter((p) => isOidb || myUnits.has(p.unitId) || myPrograms.has(p.id));

  return (
    <>
      <PageHero
        title="Program teklifleri"
        crumbs={['Yönetim']}
        subtitle="Dönemlik çift ana dal ve yan dal teklifleri, kontenjanlar, koordinatörler ve kabul edilen bölümler."
        actions={
          <div className="flex gap-2">
            <Link href={`/yazdir/kontenjan?donem=${termId}&tur=CAP`} className={buttonVariants({ variant: 'accent', size: 'sm' })}>ÇAP kontenjan ilanı</Link>
            <Link href={`/yazdir/kontenjan?donem=${termId}&tur=YANDAL`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>Yan dal ilanı</Link>
          </div>
        }
      />
      <Page>
        <div className="flex flex-wrap gap-2" aria-label="Dönem">
          {terms.map((t) => (
            <Link key={t.id} href={`?donem=${t.id}`} className={cn(buttonVariants({ size: 'sm', variant: t.id === termId ? 'accent' : 'outline' }), 'no-underline')}>
              {termLabel(t)}
            </Link>
          ))}
        </div>

        {offerings.length === 0 && <Empty>Bu dönem için teklif yok.</Empty>}
        <div className="grid gap-4 lg:grid-cols-2">
          {offerings.map((o) => (
            <Card key={o.id} className="space-y-3 p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-su-subtle">
                    {o.program.unit.name} · {LABELS.track[o.type]}
                  </p>
                  <h2 className="text-base font-semibold">{o.program.name}</h2>
                </div>
                <Badge tone={statusTone[o.status]}>{statusLabel[o.status]}</Badge>
              </div>
              <dl className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <dt className="text-xs text-su-muted">Kontenjan</dt>
                  <dd className="font-semibold">{o.quota}</dd>
                </div>
                <div>
                  <dt className="text-xs text-su-muted">Başvuru</dt>
                  <dd className="font-semibold">{o._count?.applications ?? 0}</dd>
                </div>
                <div>
                  <dt className="text-xs text-su-muted">Kayıt</dt>
                  <dd className="font-semibold">{o._count?.enrollments ?? 0}</dd>
                </div>
              </dl>
              <p className="text-xs text-su-muted">
                Koordinatör: {o.coordinatorUsername}
                {o.sourcePrograms.length > 0 && <> · Yalnızca: {o.sourcePrograms.map((s) => s.program.name).join(', ')}</>}
                {o.type === 'YANDAL' && <> · Havuz {o.poolCourses.reduce((t, c) => t + c.ects, 0)} AKTS</>}
              </p>
              <OfferingEditor o={o} />
            </Card>
          ))}
        </div>

        {manageable.length > 0 && (
          <Card>
            <CardTitle>Yeni teklif</CardTitle>
            <ActionForm action={createOfferingAction}>
              <input type="hidden" name="termId" value={termId} />
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Program">
                  <Select name="programId" required>
                    {manageable.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.unit.name})
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Tür">
                  <Select name="type">
                    {TRACK_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {LABELS.track[t]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Kontenjan">
                  <Input name="quota" type="number" min={1} required />
                </Field>
                <Field label="Koordinatör (kullanıcı adı)">
                  <Input name="coordinatorUsername" required placeholder="koord.program" />
                </Field>
                <Field label="1. sınıf mevcudu">
                  <Input name="firstYearIntake" type="number" min={1} />
                </Field>
                <Field label="Kabul edilen bölümler" hint="Boş bırakılırsa tüm bölümler (Ctrl ile çoklu seçim)">
                  <Select name="sourceProgramIds" multiple className="h-28">
                    {programs.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Field label="Yan dal ders havuzu" hint="Her satıra: KOD;Ders adı;AKTS — en az 60 AKTS (yalnızca yan dal)">
                <Textarea name="pool" placeholder={'ISL101;İşletmeye Giriş;6\nISL105;Genel Muhasebe;6'} />
              </Field>
              <Field label="Kontenjan gerekçesi (gerekirse)">
                <Input name="quotaJustification" />
              </Field>
              <SubmitButton>Taslak oluştur</SubmitButton>
            </ActionForm>
          </Card>
        )}
      </Page>
    </>
  );
}
