import Link from 'next/link';
import { APPLICATION_DOCUMENTS, LABELS } from '@cap/contracts';
import { ActionForm, SubmitButton } from '@/components/forms';
import { ApplicationBadge, RuleList, VerdictBadge } from '@/components/status';
import { Alert, Badge, Card, CardTitle, Field, Input, Page, PageHero, Table, Td, Th } from '@/components/ui';
import { api } from '@/lib/api';
import { fmtDate, fmtDateTime, fmtGpa, termLabel } from '@/lib/format';
import { withdrawApplicationAction } from '@/lib/panel-actions';
import type { ApplicationDetail } from '@/lib/types';

export const metadata = { title: 'Başvuru' };

export default async function ApplicationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ kaydedildi?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const a = await api<ApplicationDetail>(`/applications/${id}`);
  const s = a.obisSnapshot.ctx.student;
  const docs = new Set(a.documents ?? []);
  const canWithdraw = ['SUBMITTED', 'UNDER_REVIEW', 'INELIGIBLE'].includes(a.status);

  return (
    <>
      <PageHero
        title={`${a.obisSnapshot.fullName} · ${a.studentNo}`}
        crumbs={['Başvurular', a.documentNo ?? '']}
        subtitle={`${a.offering.program.name} ${LABELS.track[a.offering.type]} · ${termLabel(a.offering.term)}`}
        actions={<ApplicationBadge value={a.status} />}
      />
      <Page>
        {sp.kaydedildi && (
          <Alert tone={a.status === 'INELIGIBLE' ? 'warn' : 'ok'} title={a.status === 'INELIGIBLE' ? 'Başvuru kayda alındı: koşulları sağlamıyor.' : 'Başvuru kaydedildi.'}>
            Öğrenciye e-posta ile bilgi gönderildi.
          </Alert>
        )}
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardTitle aside={<VerdictBadge value={a.eligibility.verdict} />}>Uygunluk (başvuru anı)</CardTitle>
            <p className="mb-2 text-xs text-su-muted">
              Kural seti {a.ruleSet.version} · OBİS verisi {fmtDateTime(a.obisSnapshot.takenAt)} · GNO {fmtGpa(s.gano)} · {s.semesterNo}. yarıyıl ·{' '}
              {s.classRankPercentile != null ? `ilk %${s.classRankPercentile}` : 'sıra yok'} · {a.path === 'RANK' ? 'başarı sırası yolu' : 'YKS taban puan yolu'}
              {a.osymVerified && ' · ÖSYM doğrulandı'}
            </p>
            <RuleList results={a.eligibility.results} hideNa />
          </Card>
          <Card>
            <CardTitle>Evrak</CardTitle>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-su-muted">Evrak no · tarih</dt>
                <dd className="font-semibold">
                  {a.documentNo} · {fmtDate(a.documentDate)}
                </dd>
              </div>
              <div>
                <dt className="text-su-muted">Giren</dt>
                <dd>{a.enteredBy}</dd>
              </div>
              {a.ranking && (
                <div>
                  <dt className="text-su-muted">Sıralama</dt>
                  <dd>
                    {a.ranking.rank}. sıra · {LABELS.proposal[a.ranking.proposal]}
                    {a.ranking.overriddenBy && <span className="block text-xs">Değiştiren: {a.ranking.overriddenBy} — {a.ranking.overrideReason}</span>}
                  </dd>
                </div>
              )}
              {a.enrollment && (
                <div>
                  <dt className="text-su-muted">Kayıt</dt>
                  <dd>
                    <Link href={`/kayitlar/${a.enrollment.id}`}>Kaydı aç</Link>
                  </dd>
                </div>
              )}
              {a.withdrawReason && (
                <div>
                  <dt className="text-su-muted">Geri çekme gerekçesi</dt>
                  <dd>{a.withdrawReason}</dd>
                </div>
              )}
              {a.note && (
                <div>
                  <dt className="text-su-muted">Not</dt>
                  <dd>{a.note}</dd>
                </div>
              )}
            </dl>
            <ul className="mt-3 space-y-1 text-sm">
              {APPLICATION_DOCUMENTS.filter((d) => docs.has(d.key) || a.requiredDocuments.some((r) => r.key === d.key)).map((d) => (
                <li key={d.key} className="flex items-start gap-2">
                  {docs.has(d.key) ? <Badge tone="ok">Var</Badge> : <Badge tone="bad">Yok</Badge>}
                  <span>{d.label}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        {canWithdraw && (
          <Card>
            <CardTitle>Dilekçeyle geri çekme</CardTitle>
            <ActionForm action={withdrawApplicationAction} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="id" value={a.id} />
              <div className="min-w-72 flex-1">
                <Field label="Gerekçe (öğrenci dilekçesinin evrak numarası vb.)">
                  <Input name="reason" required minLength={5} />
                </Field>
              </div>
              <SubmitButton variant="outline" confirm="Başvuru geri çekilecek. Devam edilsin mi?">
                Geri çek
              </SubmitButton>
            </ActionForm>
          </Card>
        )}

        <Card>
          <CardTitle>Denetim kaydı</CardTitle>
          <Table>
            <thead>
              <tr>
                <Th>Zaman</Th>
                <Th>Kim</Th>
                <Th>İşlem</Th>
                <Th>Gerekçe</Th>
              </tr>
            </thead>
            <tbody>
              {a.audit.map((r) => (
                <tr key={r.id}>
                  <Td>{fmtDateTime(r.at)}</Td>
                  <Td>{r.actor}</Td>
                  <Td className="font-mono text-xs">{r.action}</Td>
                  <Td>{r.reason ?? ''}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </Page>
    </>
  );
}
