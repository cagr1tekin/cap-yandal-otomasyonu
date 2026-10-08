import Link from 'next/link';
import { LABELS } from '@cap/contracts';
import { ActionForm, SubmitButton } from '@/components/forms';
import { ApplicationBadge, RuleList, VerdictBadge } from '@/components/status';
import { Alert, Badge, buttonVariants, Card, CardTitle, Empty, Page, PageHero, Table, Td, Th } from '@/components/ui';
import { api } from '@/lib/api';
import { fmtDate, fmtDateTime, termLabel } from '@/lib/format';
import { applyAction } from '@/lib/actions';
import type { EligibilityData, MyApplication } from '@/lib/types';

export const metadata = { title: 'Başvuru' };

const phase = { TASLAK: 'Taslak', ONCE: 'Başvuru başlamadı', ACIK: 'Başvuru açık', KAPANDI: 'Başvuru kapandı' } as const;

/** Öğrenci: açık teklifler, kural bazında uygunluk ve çevrim içi başvuru. */
export default async function Apply() {
  const [d, mine] = await Promise.all([api<EligibilityData>('/me/eligibility'), api<MyApplication[]>('/me/applications')]);

  return (
    <>
      <PageHero
        title="Başvuru"
        crumbs={['Öğrenci', d.term ? termLabel(d.term) : '']}
        subtitle="Girdiğiniz bilgilerle yönerge kuralları aşağıda tek tek değerlendirilir. Uygunsanız başvurunuzu buradan yaparsınız; dilekçeyi sistem üretir."
      />
      <Page>
        {!d.hasProfile && (
          <Alert tone="warn" title="Uygunluğunuzu görmek ve başvurmak için önce bilgilerinizi girin.">
            <Link href="/ogrenci/bilgilerim">Bilgilerim ve belgelerim</Link>
          </Alert>
        )}
        {d.items.length === 0 && <Empty>Bu dönem için ilan edilmiş çift ana dal ya da yan dal teklifi yok.</Empty>}

        {d.items.map((it) => {
          const applied = it.application && it.application.status !== 'WITHDRAWN' && it.application.status !== 'INELIGIBLE';
          const canApply = d.hasProfile && it.window.open && !applied && it.verdict !== 'INELIGIBLE' && it.missingDocuments.length === 0;
          return (
            <Card key={it.offering.id}>
              <CardTitle
                aside={
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={it.window.open ? 'ok' : 'muted'}>{phase[it.window.phase]}</Badge>
                    {it.verdict && <VerdictBadge value={it.verdict} />}
                  </div>
                }
              >
                Bilgisayar Mühendisliği {LABELS.track[it.offering.type]}
                <span className="block text-xs font-normal text-su-muted">
                  Kontenjan {it.offering.quota} · {it.offering.sourcePrograms.length ? `Başvurabilen bölümler: ${it.offering.sourcePrograms.join(', ')}` : 'Tüm bölümlerden başvuru alınır'} · Başvuru{' '}
                  {fmtDate(it.window.opensAt)} – {fmtDate(it.window.closesAt)}
                  {it.offering.announceAt && ` · Sonuç ilanı ${fmtDate(it.offering.announceAt)}`}
                </span>
              </CardTitle>

              {it.results.length > 0 && <RuleList results={it.results} hideNa />}
              {it.verdict === 'CONDITIONAL' && (
                <Alert tone="info" className="mt-3" title="Koşullu: taban puan yolu">
                  Sınıfınızda ilk %20 içinde değilsiniz; başvurunuz YKS puanınızla değerlendirilir. Komisyon YKS belgenizi doğruladığında başvurunuz kesinleşir.
                </Alert>
              )}
              {d.hasProfile && it.requiredDocuments.length > 0 && (
                <div className="mt-4 rounded-lg bg-su-bg p-3 text-sm">
                  <p className="font-medium text-su-heading">Bu başvuru için gereken belgeler</p>
                  <ul className="mt-1 space-y-0.5">
                    {it.requiredDocuments.map((doc) => {
                      const missing = it.missingDocuments.some((m) => m.key === doc.key);
                      return (
                        <li key={doc.key} className={missing ? 'text-bad' : 'text-ok'}>
                          {missing ? '✗' : '✓'} {doc.label} {missing && <Link href="/ogrenci/bilgilerim">(yükle)</Link>}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              <div className="mt-4">
                {applied ? (
                  <p className="flex flex-wrap items-center gap-2 text-sm">
                    Başvurunuz kayıtlı: <ApplicationBadge value={it.application!.status} /> <Link href={`/ogrenci/basvuru/${it.application!.id}`}>Başvuruyu aç</Link>
                  </p>
                ) : canApply ? (
                  <ActionForm action={applyAction}>
                    <input type="hidden" name="offeringId" value={it.offering.id} />
                    <label className="flex items-start gap-2 text-sm">
                      <input type="checkbox" name="declaration" required className="mt-1" />
                      <span>Girdiğim bilgilerin transkriptimdeki ve YKS belgemdeki değerlerle aynı olduğunu, yanlış beyanın başvurumu geçersiz kılacağını biliyorum.</span>
                    </label>
                    <SubmitButton pending="Gönderiliyor…">{LABELS.track[it.offering.type]} başvurusu yap</SubmitButton>
                  </ActionForm>
                ) : d.hasProfile && it.verdict === 'INELIGIBLE' ? (
                  <p className="text-sm text-su-muted">Koşulları sağlamadığınız için başvuru yapılamaz. Bilgileriniz hatalıysa “Bilgilerim” sayfasında düzeltin.</p>
                ) : d.hasProfile && !it.window.open ? (
                  <p className="text-sm text-su-muted">Başvuru dönemi açık değil.</p>
                ) : null}
              </div>
            </Card>
          );
        })}

        <Card>
          <CardTitle>Başvurularım</CardTitle>
          {mine.length === 0 ? (
            <Empty>Henüz başvurunuz yok.</Empty>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Program</Th>
                  <Th>Dönem</Th>
                  <Th>Başvuru</Th>
                  <Th>Durum</Th>
                  <Th>Beyan</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {mine.map((a) => (
                  <tr key={a.id}>
                    <Td className="font-medium">Bilgisayar Mühendisliği {LABELS.track[a.offering.type]}</Td>
                    <Td>{termLabel(a.offering.term)}</Td>
                    <Td className="text-xs">{fmtDateTime(a.submittedAt)}</Td>
                    <Td>
                      <ApplicationBadge value={a.status} />
                      {a.rank && <span className="ml-1 text-xs text-su-muted">{a.rank}. sıra</span>}
                    </Td>
                    <Td className="text-xs">{LABELS.verification[a.verification]}</Td>
                    <Td>
                      {a.enrollmentId ? (
                        <Link href={`/kayitlar/${a.enrollmentId}`} className={buttonVariants({ size: 'sm', variant: 'outline' })}>
                          Kaydım
                        </Link>
                      ) : (
                        <Link href={`/ogrenci/basvuru/${a.id}`} className={buttonVariants({ size: 'sm', variant: a.registrationOpen ? 'accent' : 'outline' })}>
                          {a.registrationOpen ? 'Kesin kaydı onayla' : 'Aç'}
                        </Link>
                      )}
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
