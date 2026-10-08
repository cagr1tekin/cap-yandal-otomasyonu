import Link from 'next/link';
import { LABELS, REGISTRATION_DOCUMENTS } from '@cap/contracts';
import { ActionForm, SubmitButton } from '@/components/forms';
import { ApplicationBadge } from '@/components/status';
import { Alert, Badge, buttonVariants, Card, CardTitle, Empty, Field, Input, Page, PageHero, Stat, Table, Td, Th } from '@/components/ui';
import { api } from '@/lib/api';
import { fmtDate, fmtDateTime, fmtGpa, termLabel } from '@/lib/format';
import { registerAction } from '@/lib/panel-actions';
import { closeRegistrationAction, decisionAction, publishAction } from '@/lib/staff-actions';
import type { ReviewData } from '@/lib/types';

export const metadata = { title: 'Karar' };

export default async function DecisionPage({ params }: { params: Promise<{ offeringId: string }> }) {
  const { offeringId } = await params;
  const d = await api<ReviewData>(`/offerings/${offeringId}/applications`);
  const o = d.offering;
  const count = (s: string) => d.rows.filter((r) => r.status === s).length;
  const today = new Date().toISOString().slice(0, 10);
  const published = !!d.decision?.publishedAt;

  return (
    <>
      <PageHero
        title={o.program.name}
        crumbs={['Birim', 'Kararlar', `${LABELS.track[o.type]} · ${termLabel(o.term)}`]}
        subtitle={`Kontenjan ${o.quota}`}
        actions={
          d.decision ? (
            <div className="flex flex-wrap gap-2">
              <a href={`/api/disa-aktar/${o.id}?format=xlsx`} className={buttonVariants({ variant: 'accent', size: 'sm' })}>
                Excel
              </a>
              <a href={`/api/disa-aktar/${o.id}?format=csv`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                CSV
              </a>
              <Link href={`/yazdir/sonuc/${o.id}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                Yazdırılabilir liste
              </Link>
            </div>
          ) : null
        }
      />
      <Page>
        <div className="grid gap-3 sm:grid-cols-4">
          <Stat label="Başvuru" value={d.rows.length} />
          <Stat label="Asil / kabul" value={count('ACCEPTED') + count('ENROLLED') + d.rows.filter((r) => r.status === 'PROPOSED' && r.ranking?.proposal === 'ASIL').length} />
          <Stat label="Yedek" value={count('WAITLISTED') + d.rows.filter((r) => r.status === 'PROPOSED' && r.ranking?.proposal === 'YEDEK').length} />
          <Stat label="Kesin kayıt" value={count('ENROLLED')} />
        </div>

        <Card>
          <CardTitle>1. Yönetim kurulu kararı</CardTitle>
          {!o.rankingLockedAt ? (
            <Alert tone="info">Koordinatör bölüm önerisini kilitlediğinde karar girilebilir.</Alert>
          ) : d.decision ? (
            <Alert tone="ok" title={`Karar ${d.decision.decisionNo} (${fmtDate(d.decision.decisionDate)})`}>
              {d.decision.recordedBy} tarafından kaydedildi.
            </Alert>
          ) : (
            <ActionForm action={decisionAction}>
              <input type="hidden" name="offeringId" value={o.id} />
              <p className="text-sm text-su-muted">Kararın aslı EBYS'de kalır; burada yalnızca tarihi ve sayısı kaydedilir. Bölüm önerisi karara dönüştürülür.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Karar tarihi">
                  <Input type="date" name="decisionDate" defaultValue={today} required />
                </Field>
                <Field label="Karar sayısı">
                  <Input name="decisionNo" required placeholder="2026/45-3" />
                </Field>
              </div>
              <SubmitButton>Kararı kaydet</SubmitButton>
            </ActionForm>
          )}
        </Card>

        <Card>
          <CardTitle>2. Sonuçları yayımla</CardTitle>
          {published ? (
            <Alert tone="ok">Sonuçlar {fmtDateTime(d.decision!.publishedAt)} tarihinde yayımlandı; öğrencilere bildirim gönderildi.</Alert>
          ) : (
            <ActionForm action={publishAction}>
              <input type="hidden" name="offeringId" value={o.id} />
              <p className="text-sm text-su-muted">Yayımlanana kadar öğrenciler kurul kararını göremez.</p>
              <SubmitButton disabled={!d.decision} confirm="Sonuçlar yayımlanacak ve tüm başvuranlara bildirim gidecek. Devam edilsin mi?">
                Sonuçları yayımla
              </SubmitButton>
            </ActionForm>
          )}
        </Card>

        {published && (
          <Card>
            <CardTitle>3. Kesin kayıt ve yedekler</CardTitle>
            <p className="mb-3 text-sm text-su-muted">
              Asil öğrenci belgeleriyle birime şahsen gelir; belgeler teslim alınınca kayıt işlenir (İİBF 2023-24 belge listesi, KARARLAR K-8). Kayıt süresi
              bitince kaydolmayan asillerin yerine sıradaki yedekler çağrılır ve e-postayla bilgilendirilir.
            </p>
            <div className="space-y-2">
              {d.rows
                .filter((r) => r.status === 'ACCEPTED')
                .map((r) => (
                  <details key={r.id} className="rounded-xl border border-su-border/70 px-4 py-3">
                    <summary className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span>
                        <b>{r.fullName}</b> <span className="text-su-subtle">{r.studentNo}</span> · {r.ranking?.rank}. sıra
                      </span>
                      <span className="text-su-primary">Kesin kaydı işle</span>
                    </summary>
                    <ActionForm action={registerAction} className="mt-3">
                      <input type="hidden" name="applicationId" value={r.id} />
                      <fieldset className="grid gap-1.5 sm:grid-cols-2">
                        <legend className="mb-1 text-sm font-medium">Teslim alınan belgeler</legend>
                        {REGISTRATION_DOCUMENTS.map((doc) => (
                          <label key={doc.key} className="flex items-center gap-2 text-sm">
                            <input type="checkbox" name="documents" value={doc.key} className="size-4 accent-[var(--color-su-primary)]" />
                            {doc.label}
                          </label>
                        ))}
                      </fieldset>
                      <Field label="Not">
                        <Input name="note" />
                      </Field>
                      <SubmitButton size="sm">Kesin kaydı yap</SubmitButton>
                    </ActionForm>
                  </details>
                ))}
              {d.rows.every((r) => r.status !== 'ACCEPTED') && <Empty>Kesin kayıt bekleyen öğrenci yok.</Empty>}
            </div>
            {!o.registrationClosedAt && (
              <ActionForm action={closeRegistrationAction} className="mt-4">
                <input type="hidden" name="offeringId" value={o.id} />
                <SubmitButton variant="accent" confirm="Kayıt dönemi kapatılacak; kaydolmayan asiller düşecek ve yedekler çağrılacak. Devam edilsin mi?">
                  Kayıt dönemini kapat, yedekleri çağır
                </SubmitButton>
              </ActionForm>
            )}
          </Card>
        )}

        <Card>
          <CardTitle>Liste</CardTitle>
          {d.rows.length === 0 ? (
            <Empty>Başvuru yok.</Empty>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Sıra</Th>
                  <Th>Öğrenci</Th>
                  <Th>Ana dal</Th>
                  <Th>GNO</Th>
                  <Th>Öneri</Th>
                  <Th>Durum</Th>
                </tr>
              </thead>
              <tbody>
                {d.rows.map((r) => (
                  <tr key={r.id}>
                    <Td className="font-semibold">{r.ranking?.rank ?? '—'}</Td>
                    <Td>
                      <Link href={`/birim/basvurular/${r.id}`}>{r.fullName}</Link> <span className="text-xs text-su-subtle">{r.studentNo}</span>
                    </Td>
                    <Td>{r.mainProgramName}</Td>
                    <Td>{fmtGpa(r.gano)}</Td>
                    <Td>{r.ranking && <Badge tone={r.ranking.proposal === 'ASIL' ? 'ok' : r.ranking.proposal === 'YEDEK' ? 'warn' : 'bad'}>{LABELS.proposal[r.ranking.proposal]}</Badge>}</Td>
                    <Td>
                      <ApplicationBadge value={r.status} />
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
