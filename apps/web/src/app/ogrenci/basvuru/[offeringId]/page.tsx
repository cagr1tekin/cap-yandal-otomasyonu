import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LABELS } from '@cap/contracts';
import { ActionForm, SubmitButton } from '@/components/forms';
import { RuleList, VerdictBadge } from '@/components/status';
import { Alert, Card, CardTitle, Field, Input, Page, PageHero } from '@/components/ui';
import { api } from '@/lib/api';
import { fmtDateTime, fmtGpa } from '@/lib/format';
import type { Eligibility } from '@/lib/types';
import { applyAction } from '../../actions';

export const metadata = { title: 'Başvuru' };

export default async function Apply({ params }: { params: Promise<{ offeringId: string }> }) {
  const { offeringId } = await params;
  const [cap, yd] = await Promise.all([api<Eligibility>('/me/eligibility?type=CAP'), api<Eligibility>('/me/eligibility?type=YANDAL')]);
  const item = [...cap.items, ...yd.items].find((i) => i.offering.id === offeringId);
  if (!item) notFound();
  const s = cap.student!;
  const o = item.offering;
  const blocked = !item.window.open || item.verdict === 'INELIGIBLE' || !!item.application;

  return (
    <>
      <PageHero title={`${o.programName} — ${LABELS.track[o.type]}`} crumbs={['Öğrenci', 'Başvuru']} subtitle={o.unitName} />
      <Page className="max-w-3xl">
        <ol className="grid grid-cols-3 gap-2 text-center text-xs font-medium uppercase tracking-wide" aria-label="Başvuru adımları">
          {['1 · Program', '2 · Bilgileri onayla', '3 · Gönder'].map((s) => (
            <li key={s} className="rounded-pill bg-su-primary-soft px-2 py-2 text-su-primary">
              {s}
            </li>
          ))}
        </ol>

        <Card>
          <CardTitle aside={<VerdictBadge value={item.verdict} />}>1. Program</CardTitle>
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-su-muted">Kontenjan</dt>
              <dd className="font-semibold">{o.quota}</dd>
            </div>
            <div>
              <dt className="text-su-muted">Son başvuru</dt>
              <dd className="font-semibold">{fmtDateTime(item.window.closesAt)}</dd>
            </div>
            <div>
              <dt className="text-su-muted">Sonuç ilanı</dt>
              <dd className="font-semibold">{fmtDateTime(item.window.announceAt)}</dd>
            </div>
          </dl>
          <div className="mt-4">
            <RuleList results={item.results} hideNa />
          </div>
        </Card>

        <Card>
          <CardTitle>2. OBİS'ten okunan bilgileriniz</CardTitle>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-su-muted">Ad soyad / numara</dt>
              <dd className="font-semibold">
                {s.fullName} · {s.studentNo}
              </dd>
            </div>
            <div>
              <dt className="text-su-muted">Ana dal</dt>
              <dd className="font-semibold">{s.programName}</dd>
            </div>
            <div>
              <dt className="text-su-muted">GNO / yarıyıl</dt>
              <dd className="font-semibold">
                {fmtGpa(s.gano)} · {s.semesterNo}. yarıyıl
              </dd>
            </div>
            <div>
              <dt className="text-su-muted">Sınıf başarı sırası</dt>
              <dd className="font-semibold">{s.classRankPercentile != null ? `ilk %${s.classRankPercentile}` : '—'}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-su-muted">
            Bu bilgiler değiştirilemez; hatalı olduğunu düşünüyorsanız birim öğrenci işlerine başvurun. Başvuru anındaki değerler kayıt altına alınır.
          </p>
        </Card>

        <Card>
          <CardTitle>3. Gönder</CardTitle>
          {blocked ? (
            <Alert tone="warn" title="Bu programa şu anda başvuru yapılamaz.">
              {item.application ? 'Bu programa zaten başvurdunuz.' : !item.window.open ? 'Başvuru dönemi açık değil.' : 'Başvuru koşulları sağlanmıyor.'}{' '}
              <Link href="/ogrenci/programlar">Programlara dön</Link>
            </Alert>
          ) : (
            <ActionForm action={applyAction}>
              <input type="hidden" name="offeringId" value={o.id} />
              {item.verdict === 'CONDITIONAL' && (
                <>
                  <Alert tone="warn" title="Taban puan yoluyla başvuruyorsunuz">
                    Sınıfınızın ilk %20'sinde değilsiniz; YKS puanınız programın taban puanının üzerinde. ÖSYM sonuç belgenizin numarasını ve doğrulama
                    kodunu girin (belgeyi yüklemeniz gerekmez).
                  </Alert>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Sonuç belgesi numarası" htmlFor="doc">
                      <Input id="doc" name="osymDocNo" required autoComplete="off" placeholder="YKS2025-0000000" />
                    </Field>
                    <Field label="Doğrulama kodu" htmlFor="code">
                      <Input id="code" name="osymVerificationCode" required autoComplete="off" />
                    </Field>
                  </div>
                </>
              )}
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" name="onay" required className="mt-1 size-4 accent-[var(--color-su-primary)]" />
                <span>OBİS'ten okunan bilgilerimin doğru olduğunu ve başvuru anındaki değerlerin kayıt altına alınacağını onaylıyorum.</span>
              </label>
              <div className="flex items-center gap-3">
                <SubmitButton>Başvuruyu gönder</SubmitButton>
                <Link href="/ogrenci/programlar" className="text-sm">
                  Vazgeç
                </Link>
              </div>
            </ActionForm>
          )}
        </Card>
      </Page>
    </>
  );
}
