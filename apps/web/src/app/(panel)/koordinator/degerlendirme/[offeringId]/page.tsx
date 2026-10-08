import Link from 'next/link';
import { LABELS, PROPOSALS } from '@cap/contracts';
import { ActionForm, SubmitButton } from '@/components/forms';
import { ApplicationBadge } from '@/components/status';
import { Alert, Badge, buttonVariants, Card, CardTitle, Empty, Field, Input, Page, PageHero, Select, Stat, Table, Td, Th } from '@/components/ui';
import { api } from '@/lib/api';
import { fmtDate, fmtDateTime, fmtGpa, termLabel } from '@/lib/format';
import { closeRegistrationAction, decisionAction, lockAction, overrideAction, publishAction } from '@/lib/actions';
import { getMe, hasRole } from '@/lib/me';
import type { ReviewData } from '@/lib/types';

export const metadata = { title: 'Sıralama ve karar' };

const proposalTone = { ASIL: 'ok', YEDEK: 'warn', RET: 'bad' } as const;
const verificationTone = { PENDING: 'warn', VERIFIED: 'ok', MISMATCH: 'bad' } as const;

/** Sıralama → komisyon önerisi → kurul kararı → ilan → kesin kayıt dönemi. */
export default async function Review({ params }: { params: Promise<{ offeringId: string }> }) {
  const { offeringId } = await params;
  const [d, me] = await Promise.all([api<ReviewData>(`/offerings/${offeringId}/applications`), getMe()]);
  const o = d.offering;
  const coord = hasRole(me, 'KOORDINATOR');
  const locked = !!o.rankingLockedAt;
  const count = (...s: string[]) => d.rows.filter((r) => s.includes(r.status)).length;
  const asil = d.rows.filter((r) => r.ranking?.proposal === 'ASIL').length;

  return (
    <>
      <PageHero
        title={`Bilgisayar Mühendisliği ${LABELS.track[o.type]}`}
        crumbs={['Başvuru süreci', 'Sıralama ve karar', termLabel(o.term)]}
        subtitle={`Sıralama ölçütü: ${d.strategy}. Mevzuatta ölçüt yoktur; fakültedeki uygulama GNO sırasıdır (KARARLAR K-3).`}
      />
      <Page>
        <div className="grid gap-3 sm:grid-cols-4">
          <Stat label="Kontenjan" value={o.quota} />
          <Stat label="Değerlendirilen başvuru" value={d.rows.length} />
          <Stat label="Asil önerisi" value={asil} />
          <Stat label="Kesin kayıt" value={count('ENROLLED')} hint={`${count('ACCEPTED')} asil kayıt bekliyor`} />
        </div>

        {!d.windowClosed && <Alert tone="info" title="Başvuru dönemi sürüyor.">Sıralama başvurular geldikçe güncellenir; öneri başvuru dönemi kapanınca kilitlenebilir.</Alert>}
        {d.windowClosed && !locked && d.unverified > 0 && (
          <Alert tone="warn" title={`${d.unverified} başvurunun beyanı doğrulanmadı.`}>
            Öğrencinin kendi girdiği bilgiler belgeyle doğrulanmadan öneri kilitlenemez. <Link href="/koordinator/basvurular?dogrulama=PENDING">Doğrulanacak başvurular</Link>
          </Alert>
        )}

        <Card>
          <CardTitle
            aside={
              d.decision && (
                <div className="flex flex-wrap gap-2">
                  <Link href={`/yazdir/sonuc/${o.id}`} className={buttonVariants({ size: 'sm', variant: 'outline' })}>
                    İlan listesi (maskeli)
                  </Link>
                  <a href={`/api/disa-aktar/${o.id}?format=xlsx`} className={buttonVariants({ size: 'sm', variant: 'outline' })}>
                    Excel
                  </a>
                </div>
              )
            }
          >
            Sıralama
          </CardTitle>
          {d.rows.length === 0 ? (
            <Empty>Değerlendirilecek başvuru yok.</Empty>
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
                  <Th>Beyan</Th>
                  <Th>Öneri</Th>
                  <Th>Durum</Th>
                </tr>
              </thead>
              <tbody>
                {d.rows.map((r) => (
                  <tr key={r.id}>
                    <Td>{r.ranking?.rank}</Td>
                    <Td>
                      <Link href={`/koordinator/basvurular/${r.id}`} className="font-medium">
                        {r.fullName}
                      </Link>
                      <span className="block text-xs text-su-subtle">{r.studentNo}</span>
                    </Td>
                    <Td>{r.mainProgramName}</Td>
                    <Td>{fmtGpa(r.gano)}</Td>
                    <Td>{r.classRankPercentile != null ? String(r.classRankPercentile).replace('.', ',') : '—'}</Td>
                    <Td className="text-xs">{r.path === 'RANK' ? 'Başarı sırası' : 'Taban puan'}</Td>
                    <Td>
                      <Badge tone={verificationTone[r.verification]}>{LABELS.verification[r.verification]}</Badge>
                    </Td>
                    <Td>
                      {r.ranking && <Badge tone={proposalTone[r.ranking.proposal]}>{LABELS.proposal[r.ranking.proposal]}</Badge>}
                      {r.ranking?.overriddenBy && <span className="block text-[11px] text-su-muted">değiştirildi: {r.ranking.overrideReason}</span>}
                      {coord && !locked && r.ranking && (
                        <details className="mt-1">
                          <summary className="text-xs text-su-primary">Değiştir</summary>
                          <ActionForm action={overrideAction} className="mt-2 w-56">
                            <input type="hidden" name="applicationId" value={r.id} />
                            <Select name="proposal" defaultValue={r.ranking.proposal} aria-label="Öneri">
                              {PROPOSALS.map((p) => (
                                <option key={p} value={p}>
                                  {LABELS.proposal[p]}
                                </option>
                              ))}
                            </Select>
                            <Input name="reason" required minLength={5} placeholder="Gerekçe" aria-label="Gerekçe" />
                            <SubmitButton size="sm" variant="outline">
                              Kaydet
                            </SubmitButton>
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

        <div className="grid gap-6 lg:grid-cols-3">
          <Card>
            <CardTitle>1. Komisyon önerisi</CardTitle>
            {locked ? (
              <p className="text-sm text-su-muted">Öneri {fmtDateTime(o.rankingLockedAt)} tarihinde kilitlendi.</p>
            ) : coord ? (
              <ActionForm action={lockAction}>
                <input type="hidden" name="offeringId" value={o.id} />
                <p className="text-sm text-su-muted">Kilitlenen öneri fakülte yönetim kuruluna sunulur; sonra değiştirilemez.</p>
                <SubmitButton disabled={!d.windowClosed || d.rows.length === 0} confirm="Öneri kilitlenecek ve değiştirilemeyecek. Devam edilsin mi?">
                  Öneriyi kilitle
                </SubmitButton>
              </ActionForm>
            ) : (
              <p className="text-sm text-su-muted">Komisyon önerisi henüz kilitlenmedi.</p>
            )}
          </Card>

          <Card>
            <CardTitle>2. Kurul kararı ve ilan</CardTitle>
            {d.decision ? (
              <div className="space-y-3 text-sm">
                <p>
                  Karar {d.decision.decisionNo} · {fmtDate(d.decision.decisionDate)}
                  <span className="block text-xs text-su-muted">Kaydeden: {d.decision.recordedBy}</span>
                </p>
                {d.decision.publishedAt ? (
                  <p className="text-su-muted">Sonuçlar {fmtDateTime(d.decision.publishedAt)} tarihinde yayımlandı.</p>
                ) : (
                  coord && (
                    <ActionForm action={publishAction}>
                      <input type="hidden" name="offeringId" value={o.id} />
                      <SubmitButton variant="accent" confirm="Sonuçlar öğrencilere açılacak ve bildirim gidecek. Yayımlansın mı?">
                        Sonuçları yayımla
                      </SubmitButton>
                    </ActionForm>
                  )
                )}
              </div>
            ) : locked && coord ? (
              <ActionForm action={decisionAction}>
                <input type="hidden" name="offeringId" value={o.id} />
                <p className="text-xs text-su-muted">Karar fakülte yönetim kurulunda alınır; burada sayısı ve tarihi kaydedilir.</p>
                <Field label="Karar tarihi">
                  <Input name="decisionDate" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
                </Field>
                <Field label="Karar sayısı">
                  <Input name="decisionNo" required placeholder="2026/41-7" />
                </Field>
                <SubmitButton>Kararı kaydet</SubmitButton>
              </ActionForm>
            ) : (
              <p className="text-sm text-su-muted">Önce komisyon önerisi kilitlenmeli.</p>
            )}
          </Card>

          <Card>
            <CardTitle>3. Kesin kayıt dönemi</CardTitle>
            {o.registrationClosedAt ? (
              <p className="text-sm text-su-muted">Kayıt dönemi {fmtDateTime(o.registrationClosedAt)} tarihinde kapatıldı.</p>
            ) : d.decision?.publishedAt ? (
              <div className="space-y-3 text-sm">
                <p className="text-su-muted">
                  Kabul edilen öğrenci kaydını kendisi onaylar. Süre dolunca dönemi kapatın: kaydolmayan asiller düşer, sıradaki yedekler çağrılır.
                  {o.registrationDeadline && ` Asil son gün: ${fmtDate(o.registrationDeadline)}.`}
                </p>
                {coord && (
                  <ActionForm action={closeRegistrationAction}>
                    <input type="hidden" name="offeringId" value={o.id} />
                    <SubmitButton variant="outline" confirm="Kaydını onaylamayan asiller düşecek ve yedekler çağrılacak. Devam edilsin mi?">
                      Kayıt dönemini kapat
                    </SubmitButton>
                  </ActionForm>
                )}
              </div>
            ) : (
              <p className="text-sm text-su-muted">Sonuçlar yayımlanınca başlar.</p>
            )}
          </Card>
        </div>
      </Page>
    </>
  );
}
