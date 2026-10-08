import { LABELS, TRACK_TYPES } from '@cap/contracts';
import { ActionForm, SubmitButton } from '@/components/forms';
import { Alert, Badge, Card, CardTitle, Field, Input, Page, PageHero, Select, Table, Td, Th } from '@/components/ui';
import { api } from '@/lib/api';
import { fmtDateTime, termLabel, toLocalInput } from '@/lib/format';
import { closeNowAction, createOfferingAction, offeringStatusAction, updateOfferingAction, yearStatAction } from '@/lib/actions';
import { getMe, hasRole } from '@/lib/me';
import type { OfferingRow, Program, Term, YearStat } from '@/lib/types';

export const metadata = { title: 'Kontenjan ve takvim' };

const phase = { TASLAK: 'Taslak', ONCE: 'Başvuru başlamadı', ACIK: 'Başvuru açık', KAPANDI: 'Başvuru kapandı' } as const;
const statusLabel = { DRAFT: 'Taslak', PUBLISHED: 'Yayımda', CLOSED: 'Kapalı' } as const;
const statusTone = { DRAFT: 'warn', PUBLISHED: 'ok', CLOSED: 'muted' } as const;

function Dates({ o }: { o?: OfferingRow }) {
  const v = (d?: string | null) => (d ? toLocalInput(d) : '');
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <Field label="Başvuru başlangıcı">
        <Input name="opensAt" type="datetime-local" required defaultValue={v(o?.opensAt)} />
      </Field>
      <Field label="Başvuru bitişi">
        <Input name="closesAt" type="datetime-local" required defaultValue={v(o?.closesAt)} />
      </Field>
      <Field label="Sonuç ilanı">
        <Input name="announceAt" type="datetime-local" defaultValue={v(o?.announceAt)} />
      </Field>
      <Field label="Asil kayıt son günü">
        <Input name="registrationDeadline" type="datetime-local" defaultValue={v(o?.registrationDeadline)} />
      </Field>
      <Field label="Yedek kayıt son günü">
        <Input name="waitlistDeadline" type="datetime-local" defaultValue={v(o?.waitlistDeadline)} />
      </Field>
    </div>
  );
}

function Sources({ programs, selected }: { programs: Program[]; selected: string[] }) {
  return (
    <fieldset>
      <legend className="text-sm font-medium text-su-heading">Başvuru kabul edilen bölümler</legend>
      <p className="mb-1 text-xs text-su-muted">Hiçbiri seçilmezse her bölümden başvuru alınır (kontenjan ilanındaki dipnot).</p>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {programs.map((p) => (
          <label key={p.id} className="flex items-center gap-1.5">
            <input type="checkbox" name="sourceProgramIds" value={p.id} defaultChecked={selected.includes(p.id)} />
            {p.name}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Dönem teklifi: kontenjan, kaynak bölümler ve başvuru takvimi. Yıllara göre taban puan tablosu. */
export default async function TermSetup({ searchParams }: { searchParams: Promise<{ donem?: string }> }) {
  const { donem } = await searchParams;
  const [terms, allPrograms, stats, me] = await Promise.all([api<Term[]>('/terms'), api<Program[]>('/programs'), api<YearStat[]>('/year-stats'), getMe()]);
  const term = terms.find((t) => t.id === donem) ?? terms.find((t) => t.isCurrent) ?? terms[0];
  const offerings = await api<OfferingRow[]>(`/offerings?termId=${term.id}`);
  const programs = allPrograms.filter((p) => !p.isHome);
  const canEdit = hasRole(me, 'KOORDINATOR');
  const missing = TRACK_TYPES.filter((t) => !offerings.some((o) => o.type === t));

  return (
    <>
      <PageHero
        title="Kontenjan ve takvim"
        crumbs={['Başvuru süreci', termLabel(term)]}
        subtitle="Her dönem için çift ana dal ve yan dal teklifi: kontenjan, başvuru kabul edilen bölümler ve takvim. Yayımlanan teklif öğrencilere açılır."
        actions={
          <form className="flex items-end gap-2">
            <Select name="donem" defaultValue={term.id} aria-label="Dönem" className="w-48">
              {terms.map((t) => (
                <option key={t.id} value={t.id}>
                  {termLabel(t)}
                </option>
              ))}
            </Select>
            <button className="h-10 rounded-pill bg-su-accent px-4 text-sm font-medium text-su-primary-dark">Göster</button>
          </form>
        }
      />
      <Page>
        {!canEdit && <Alert tone="info" title="Teklif ve takvimi komisyon düzenler; bu sayfayı salt okunur görüyorsunuz." />}
        {offerings.map((o) => (
          <Card key={o.id}>
            <CardTitle
              aside={
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={statusTone[o.status]}>{statusLabel[o.status]}</Badge>
                  <Badge tone={o.window.open ? 'ok' : 'muted'}>{phase[o.window.phase]}</Badge>
                </div>
              }
            >
              Bilgisayar Mühendisliği {LABELS.track[o.type]}
              <span className="block text-xs font-normal text-su-muted">
                {o._count?.applications ?? 0} başvuru · {o._count?.enrollments ?? 0} kayıt
                {o.rankingLockedAt && ` · sıralama ${fmtDateTime(o.rankingLockedAt)} tarihinde kilitlendi`}
              </span>
            </CardTitle>
            {canEdit ? (
              <>
                <ActionForm action={updateOfferingAction} className="space-y-4">
                  <input type="hidden" name="id" value={o.id} />
                  <input type="hidden" name="locked" value={o.rankingLockedAt ? '1' : '0'} />
                  {o.rankingLockedAt ? (
                    <p className="text-sm text-su-muted">
                      Kontenjan {o.quota} · {o.sourcePrograms.length ? o.sourcePrograms.map((s) => s.program.name).join(', ') : 'tüm bölümler'} (sıralama kilitlendiği için değişmez)
                    </p>
                  ) : (
                    <>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <Field label="Kontenjan">
                          <Input name="quota" type="number" min={1} required defaultValue={o.quota} />
                        </Field>
                        <Field label="Birinci sınıf kontenjanı" hint="Asgari kontenjan kuralı için (KR-ÇAP-09)">
                          <Input name="firstYearIntake" type="number" min={1} defaultValue={o.firstYearIntake ?? ''} />
                        </Field>
                        <Field label="Kontenjan gerekçesi">
                          <Input name="quotaJustification" defaultValue={o.quotaJustification ?? ''} />
                        </Field>
                      </div>
                      <Sources programs={programs} selected={o.sourcePrograms.map((s) => s.programId)} />
                    </>
                  )}
                  <Dates o={o} />
                  <SubmitButton size="sm">Kaydet</SubmitButton>
                </ActionForm>
                <div className="mt-4 flex flex-wrap gap-2 border-t border-su-border/60 pt-4">
                  {o.status === 'DRAFT' && (
                    <ActionForm action={offeringStatusAction} className="space-y-0">
                      <input type="hidden" name="id" value={o.id} />
                      <input type="hidden" name="status" value="PUBLISHED" />
                      <SubmitButton size="sm" variant="accent" confirm="Teklif öğrencilere açılacak. Yayımlansın mı?">
                        Yayımla
                      </SubmitButton>
                    </ActionForm>
                  )}
                  <ActionForm action={closeNowAction} className="space-y-0">
                    <input type="hidden" name="id" value={o.id} />
                    <SubmitButton size="sm" variant="outline" disabled={o.window.phase === 'KAPANDI'} confirm="Başvuru dönemi şimdi kapatılacak. Devam edilsin mi?">
                      Başvuruyu şimdi kapat
                    </SubmitButton>
                  </ActionForm>
                </div>
              </>
            ) : (
              <p className="text-sm text-su-muted">
                Kontenjan {o.quota} · {o.sourcePrograms.length ? o.sourcePrograms.map((s) => s.program.name).join(', ') : 'tüm bölümler'} · başvuru {fmtDateTime(o.opensAt)} – {fmtDateTime(o.closesAt)}
              </p>
            )}
          </Card>
        ))}

        {canEdit && missing.length > 0 && (
          <Card>
            <CardTitle>Yeni teklif</CardTitle>
            <ActionForm action={createOfferingAction} className="space-y-4">
              <input type="hidden" name="termId" value={term.id} />
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Tür">
                  <Select name="type">
                    {missing.map((t) => (
                      <option key={t} value={t}>
                        {LABELS.track[t]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Kontenjan">
                  <Input name="quota" type="number" min={1} required />
                </Field>
                <Field label="Birinci sınıf kontenjanı">
                  <Input name="firstYearIntake" type="number" min={1} />
                </Field>
              </div>
              <Sources programs={programs} selected={[]} />
              <Dates />
              <SubmitButton size="sm">Taslak oluştur</SubmitButton>
            </ActionForm>
          </Card>
        )}

        <Card>
          <CardTitle>Taban puan ve başarı sırası şartı</CardTitle>
          <p className="mb-3 text-sm text-su-muted">
            Sınıfında ilk %20’ye giremeyen öğrenci, ana dala kayıt olduğu yıl Bilgisayar Mühendisliğinin taban puanına sahipse başvurabilir (ÇAP Yön. m.5/1-d). Mühendislikte ayrıca kayıt yılındaki
            başarı sırası şartı aranır (m.5/1-e). OBİS ve YÖK Atlas bağlantısı olmadığı için değerleri komisyon girer.
          </p>
          <Table>
            <thead>
              <tr>
                <Th>Yıl</Th>
                <Th>Taban puan</Th>
                <Th>Başarı sırası şartı</Th>
                <Th>Giren</Th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s) => (
                <tr key={s.year}>
                  <Td>{s.year}</Td>
                  <Td>{String(s.baseScore).replace('.', ',')}</Td>
                  <Td>{s.successRankLimit ? s.successRankLimit.toLocaleString('tr-TR') : '—'}</Td>
                  <Td className="text-xs text-su-muted">{s.updatedBy === 'seed' ? 'temsilî değer' : s.updatedBy}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          {canEdit && (
            <ActionForm action={yearStatAction} className="mt-4 flex flex-wrap items-end gap-3">
              <Field label="Yıl">
                <Input name="year" type="number" min={2015} required className="w-28" />
              </Field>
              <Field label="Taban puan">
                <Input name="baseScore" required inputMode="decimal" className="w-32" />
              </Field>
              <Field label="Başarı sırası şartı">
                <Input name="successRankLimit" type="number" defaultValue={300000} className="w-40" />
              </Field>
              <SubmitButton size="sm" variant="outline">
                Ekle / güncelle
              </SubmitButton>
            </ActionForm>
          )}
        </Card>
      </Page>
    </>
  );
}
