import Link from 'next/link';
import { LABELS } from '@cap/contracts';
import { ActionForm, SubmitButton } from '@/components/forms';
import { ApplicationBadge } from '@/components/status';
import { Alert, Badge, buttonVariants, Card, CardTitle, Empty, Field, Input, Page, PageHero, Stat, Table, Td, Th } from '@/components/ui';
import { api } from '@/lib/api';
import { fmtDate, fmtDateTime, fmtGpa, termLabel } from '@/lib/format';
import { closeRegistrationAction, decisionAction, publishAction, syncAction } from '@/lib/staff-actions';
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
              <Link href={`/yazdir/${o.id}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
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
            <p className="mb-3 text-sm text-su-muted">Kesin kayıt OBİS'te yapılır. Kayıtları OBİS'ten eşitleyin; kayıt süresi bitince kaydolmayan asillerin yerine sıradaki yedekler çağrılır.</p>
            <div className="flex flex-wrap gap-3">
              <ActionForm action={syncAction}>
                <input type="hidden" name="offeringId" value={o.id} />
                <SubmitButton variant="outline">OBİS'ten kayıtları eşitle</SubmitButton>
              </ActionForm>
              {!o.registrationClosedAt && (
                <ActionForm action={closeRegistrationAction}>
                  <input type="hidden" name="offeringId" value={o.id} />
                  <SubmitButton variant="accent" confirm="Kayıt dönemi kapatılacak; kaydolmayan asiller düşecek ve yedekler çağrılacak. Devam edilsin mi?">
                    Kayıt dönemini kapat, yedekleri çağır
                  </SubmitButton>
                </ActionForm>
              )}
            </div>
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
                      {r.fullName} <span className="text-xs text-su-subtle">{r.studentNo}</span>
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
