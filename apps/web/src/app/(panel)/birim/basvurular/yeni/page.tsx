import Link from 'next/link';
import { APPLICATION_DOCUMENTS, LABELS, type TrackType } from '@cap/contracts';
import { ActionForm, SubmitButton } from '@/components/forms';
import { ApplicationBadge, RuleList, VerdictBadge } from '@/components/status';
import { Alert, buttonVariants, Card, CardTitle, Field, Input, Page, PageHero, Select, Textarea } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { cn, fmtDateTime, fmtGpa } from '@/lib/format';
import { intakeAction } from '@/lib/panel-actions';
import type { Candidates } from '@/lib/types';

export const metadata = { title: 'Yeni başvuru girişi' };

/**
 * Başvuru girişi (KARARLAR K-1): 1) öğrenci no → OBİS bilgisi ve uygunluk, 2) program seçimi,
 * 3) evrak kaydı ve belge kontrol listesi.
 */
export default async function Intake({ searchParams }: { searchParams: Promise<{ no?: string; tur?: string; teklif?: string }> }) {
  const sp = await searchParams;
  const type: TrackType = sp.tur === 'YANDAL' ? 'YANDAL' : 'CAP';
  const no = sp.no?.trim() ?? '';
  let data: Candidates | null = null;
  let error: string | null = null;
  if (/^\d{9}$/.test(no)) {
    try {
      data = await api<Candidates>(`/intake/candidates?studentNo=${no}&type=${type}`);
    } catch (e) {
      if (e instanceof ApiError) error = e.problem.detail ?? e.problem.title;
      else throw e;
    }
  } else if (no) {
    error = 'Öğrenci numarası 9 haneli olmalı.';
  }
  const selected = data?.items.find((i) => i.offering.id === sp.teklif);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <PageHero title="Yeni başvuru girişi" crumbs={['Başvurular']} subtitle="Şahsen verilen dilekçeyi öğrenci numarasıyla girin." />
      <Page className="max-w-5xl">
        <Card>
          <CardTitle>1. Öğrenci</CardTitle>
          <form className="flex flex-wrap items-end gap-3">
            <Field label="Öğrenci numarası" htmlFor="no">
              <Input id="no" name="no" defaultValue={no} inputMode="numeric" pattern="\d{9}" required className="w-48" autoFocus={!no} />
            </Field>
            <Field label="Başvuru türü" htmlFor="tur">
              <Select id="tur" name="tur" defaultValue={type}>
                <option value="CAP">{LABELS.track.CAP}</option>
                <option value="YANDAL">{LABELS.track.YANDAL}</option>
              </Select>
            </Field>
            <button className={buttonVariants()}>OBİS'ten getir</button>
          </form>
          {error && (
            <Alert tone="bad" className="mt-3">
              {error}
            </Alert>
          )}
          {data?.student && (
            <dl className="mt-4 grid gap-3 rounded-xl bg-su-bg p-4 text-sm sm:grid-cols-4">
              <div className="sm:col-span-2">
                <dt className="text-su-muted">Öğrenci</dt>
                <dd className="font-semibold">
                  {data.student.fullName} · {data.student.studentNo}
                </dd>
                <dd className="text-su-muted">
                  {data.student.programName} — {data.student.unitName}
                </dd>
              </div>
              <div>
                <dt className="text-su-muted">GNO · yarıyıl</dt>
                <dd className="font-semibold">
                  {fmtGpa(data.student.gano)} · {data.student.semesterNo}.
                </dd>
              </div>
              <div>
                <dt className="text-su-muted">Sınıf sırası · YKS</dt>
                <dd className="font-semibold">
                  {data.student.classRankPercentile != null ? `ilk %${data.student.classRankPercentile}` : '—'} ·{' '}
                  {data.student.entryScore ? `${data.student.entryScore.score} (${data.student.entryScore.year})` : '—'}
                </dd>
              </div>
              {data.otherApplications.length > 0 && (
                <div className="sm:col-span-4">
                  <dt className="text-su-muted">Bu dönemdeki diğer başvuruları</dt>
                  <dd className="mt-1 flex flex-wrap gap-2">
                    {data.otherApplications.map((a) => (
                      <span key={a.id} className="inline-flex items-center gap-1 text-xs">
                        {a.programName} ({LABELS.track[a.type]}) <ApplicationBadge value={a.status} />
                      </span>
                    ))}
                  </dd>
                </div>
              )}
            </dl>
          )}
        </Card>

        {data && (
          <Card>
            <CardTitle>2. Program</CardTitle>
            {data.items.length === 0 ? (
              <Alert tone="info">Biriminizde bu dönem yayımlanmış {LABELS.track[type].toLowerCase()} teklifi yok.</Alert>
            ) : (
              <ul className="space-y-2">
                {data.items.map((i) => {
                  const failed = i.results.filter((r) => r.status === 'FAIL');
                  const active = i.offering.id === sp.teklif;
                  return (
                    <li key={i.offering.id} className={cn('rounded-xl border p-3', active ? 'border-su-primary bg-su-primary-soft' : 'border-su-border/70')}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-semibold">{i.offering.programName}</p>
                          <p className="text-xs text-su-muted">
                            Kontenjan {i.offering.quota} · {i.window.open ? `başvuru açık (son ${fmtDateTime(i.window.closesAt)})` : 'başvuru dönemi dışında'}
                            {i.offering.sourcePrograms.length > 0 && ` · yalnızca: ${i.offering.sourcePrograms.join(', ')}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <VerdictBadge value={i.verdict} />
                          {i.application ? (
                            <Link href={`/birim/basvurular/${i.application.id}`} className="text-sm">
                              Kayıtlı başvuru
                            </Link>
                          ) : (
                            <Link href={`?no=${no}&tur=${type}&teklif=${i.offering.id}`} className={buttonVariants({ size: 'sm', variant: active ? 'primary' : 'outline' })}>
                              Seç
                            </Link>
                          )}
                        </div>
                      </div>
                      {failed.length > 0 && (
                        <ul className="mt-2 space-y-0.5 text-xs text-bad">
                          {failed.map((r) => (
                            <li key={r.code}>
                              {r.message} <span className="text-su-subtle">({r.article})</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        )}

        {data && selected && !selected.application && (
          <Card>
            <CardTitle aside={<VerdictBadge value={selected.verdict} />}>3. Evrak kaydı ve belge kontrolü — {selected.offering.programName}</CardTitle>
            {selected.verdict === 'INELIGIBLE' && (
              <Alert tone="warn" title="Öğrenci koşulları sağlamıyor.">
                Dilekçe yine de kayda alınır ve "koşulları sağlamıyor" olarak işaretlenir; öğrenciye gerekçeli e-posta gönderilir.
              </Alert>
            )}
            <details className="my-3 rounded-lg bg-su-bg px-3 py-2">
              <summary className="text-sm font-medium text-su-primary">Tüm koşullar</summary>
              <RuleList results={selected.results} hideNa />
            </details>
            <ActionForm action={intakeAction}>
              <input type="hidden" name="studentNo" value={no} />
              <input type="hidden" name="offeringId" value={selected.offering.id} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Evrak kayıt numarası" htmlFor="documentNo">
                  <Input id="documentNo" name="documentNo" required placeholder="E-2026/1234" />
                </Field>
                <Field label="Dilekçe tarihi" htmlFor="documentDate">
                  <Input id="documentDate" name="documentDate" type="date" defaultValue={today} required />
                </Field>
              </div>
              <fieldset className="rounded-xl border border-su-border/70 p-3">
                <legend className="px-1 text-sm font-medium">Teslim alınan belgeler</legend>
                <p className="mb-2 text-xs text-su-muted">
                  Zorunlular işaretli gelir; {selected.path === 'RANK' ? 'başarı sırası yolu' : 'YKS taban puan yolu'} ve program koşullarına göre belirlenir.
                </p>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {APPLICATION_DOCUMENTS.map((d) => {
                    const required = selected.requiredDocuments.some((r) => r.key === d.key);
                    return (
                      <label key={d.key} className="flex items-start gap-2 text-sm">
                        <input type="checkbox" name="documents" value={d.key} defaultChecked={required} className="mt-1 size-4 accent-[var(--color-su-primary)]" />
                        <span>
                          {d.label} {required && <b className="text-xs text-bad">zorunlu</b>}
                          <span className="block text-xs text-su-subtle">{d.source}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
              {(selected.verdict === 'CONDITIONAL' || selected.path === 'ENTRY_SCORE') && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="ÖSYM sonuç belgesi numarası" htmlFor="osymDocNo">
                    <Input id="osymDocNo" name="osymDocNo" autoComplete="off" placeholder="YKS2025-0000000" />
                  </Field>
                  <Field label="Doğrulama kodu" htmlFor="osymVerificationCode">
                    <Input id="osymVerificationCode" name="osymVerificationCode" autoComplete="off" />
                  </Field>
                </div>
              )}
              <Field label="Not" htmlFor="note">
                <Textarea id="note" name="note" className="min-h-16" />
              </Field>
              <SubmitButton>Başvuruyu kaydet</SubmitButton>
            </ActionForm>
          </Card>
        )}
      </Page>
    </>
  );
}
