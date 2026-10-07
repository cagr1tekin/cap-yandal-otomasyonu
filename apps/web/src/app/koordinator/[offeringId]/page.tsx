import Link from 'next/link';
import { LABELS, PROPOSALS } from '@cap/contracts';
import { ActionForm, SubmitButton } from '@/components/forms';
import { ApplicationBadge } from '@/components/status';
import { Alert, Badge, buttonVariants, Card, CardTitle, Empty, Field, Input, Page, PageHero, Select, Table, Td, Th } from '@/components/ui';
import { api } from '@/lib/api';
import { fmtDateTime, fmtGpa, termLabel } from '@/lib/format';
import { lockAction, overrideAction } from '@/lib/staff-actions';
import type { ReviewData } from '@/lib/types';

export const metadata = { title: 'Başvurular ve sıralama' };

const proposalTone = { ASIL: 'ok', YEDEK: 'warn', RET: 'bad' } as const;

export default async function Review({ params }: { params: Promise<{ offeringId: string }> }) {
  const { offeringId } = await params;
  const d = await api<ReviewData>(`/offerings/${offeringId}/applications`);
  const o = d.offering;
  const locked = !!o.rankingLockedAt;
  const asil = d.rows.filter((r) => r.ranking?.proposal === 'ASIL').length;

  return (
    <>
      <PageHero
        title={o.program.name}
        crumbs={['Koordinatörlük', `${LABELS.track[o.type]} · ${termLabel(o.term)}`]}
        subtitle={`Kontenjan ${o.quota} · ${d.rows.length} başvuru · asil önerisi ${asil}`}
        actions={
          <div className="flex gap-2">
            <Link href={`/koordinator/${o.id}/ogrenciler`} className={buttonVariants({ variant: 'accent', size: 'sm' })}>
              Kayıtlı öğrenciler
            </Link>
            {d.decision && (
              <a href={`/api/disa-aktar/${o.id}?format=xlsx`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                Excel
              </a>
            )}
          </div>
        }
      />
      <Page>
        {!d.windowClosed && (
          <Alert tone="info" title="Başvuru dönemi sürüyor.">
            Sıralama her başvuruda yeniden hesaplanır; öneri ancak dönem kapandıktan sonra kilitlenebilir.
          </Alert>
        )}
        {locked && (
          <Alert tone="ok" title={`Öneri ${fmtDateTime(o.rankingLockedAt)} tarihinde kilitlendi.`}>
            {d.decision
              ? `Yönetim kurulu kararı ${d.decision.decisionNo} ${d.decision.publishedAt ? 've sonuçlar yayımlandı.' : 'kaydedildi; yayım bekleniyor.'}`
              : 'Birim öğrenci işlerinin yönetim kurulu kararını girmesi bekleniyor.'}
          </Alert>
        )}

        <Card>
          <CardTitle
            aside={
              !locked && d.windowClosed ? (
                <ActionForm action={lockAction}>
                  <input type="hidden" name="offeringId" value={o.id} />
                  <SubmitButton size="sm" confirm="Öneri kilitlenince değişiklik yapılamaz. Devam edilsin mi?">
                    Öneriyi kilitle ve birime gönder
                  </SubmitButton>
                </ActionForm>
              ) : null
            }
          >
            Sıralama
            <span className="block text-xs font-normal text-su-muted">Ölçüt: {d.strategy}</span>
          </CardTitle>
          {d.rows.length === 0 ? (
            <Empty>Henüz başvuru yok.</Empty>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Sıra</Th>
                  <Th>Öğrenci</Th>
                  <Th>Ana dal</Th>
                  <Th>GNO</Th>
                  <Th>Sınıf %</Th>
                  <Th>Yol</Th>
                  <Th>Öneri</Th>
                  <Th>Durum</Th>
                </tr>
              </thead>
              <tbody>
                {d.rows.map((r) => (
                  <tr key={r.id} className={r.ranking?.proposal === 'ASIL' ? 'bg-ok-soft/40' : undefined}>
                    <Td className="font-semibold">{r.ranking?.rank ?? '—'}</Td>
                    <Td>
                      <p className="font-medium">{r.fullName}</p>
                      <p className="text-xs text-su-subtle">{r.studentNo}</p>
                    </Td>
                    <Td>{r.mainProgramName}</Td>
                    <Td>{fmtGpa(r.gano)}</Td>
                    <Td>{r.classRankPercentile ?? '—'}</Td>
                    <Td>
                      {r.path === 'RANK' ? 'Başarı sırası' : 'YKS taban puan'}
                      {r.osymVerified && <span className="block text-xs text-ok">ÖSYM doğrulandı</span>}
                    </Td>
                    <Td>
                      {r.ranking && <Badge tone={proposalTone[r.ranking.proposal]}>{LABELS.proposal[r.ranking.proposal]}</Badge>}
                      {r.ranking?.overriddenBy && (
                        <p className="mt-1 max-w-48 text-xs text-su-muted" title={r.ranking.overrideReason ?? ''}>
                          Değiştirildi: {r.ranking.overrideReason}
                        </p>
                      )}
                      {!locked && r.ranking && (
                        <details className="mt-1">
                          <summary className="text-xs text-su-primary">Değiştir</summary>
                          <ActionForm action={overrideAction} className="mt-2 w-64">
                            <input type="hidden" name="applicationId" value={r.id} />
                            <Field label="Yeni öneri">
                              <Select name="proposal" defaultValue={r.ranking.proposal}>
                                {PROPOSALS.map((p) => (
                                  <option key={p} value={p}>
                                    {LABELS.proposal[p]}
                                  </option>
                                ))}
                              </Select>
                            </Field>
                            <Field label="Gerekçe" hint="Denetim kaydına yazılır.">
                              <Input name="reason" required minLength={5} />
                            </Field>
                            <SubmitButton size="sm">Kaydet</SubmitButton>
                          </ActionForm>
                        </details>
                      )}
                    </Td>
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
