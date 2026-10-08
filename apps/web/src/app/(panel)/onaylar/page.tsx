import Link from 'next/link';
import { LABELS } from '@cap/contracts';
import { ActionForm, SubmitButton } from '@/components/forms';
import { Badge, Card, Empty, Field, Input, Page, PageHero } from '@/components/ui';
import { api } from '@/lib/api';
import { fmtDateTime } from '@/lib/format';
import { decideApprovalAction } from '@/lib/panel-actions';
import type { MyApproval } from '@/lib/types';

export const metadata = { title: 'Onaylarım' };

/** Kâğıt formların imza turunun karşılığı: kullanıcıya atanmış bekleyen imzalar. */
export default async function Approvals() {
  const items = await api<MyApproval[]>('/approvals/mine');
  return (
    <>
      <PageHero
        title="Onaylarım"
        subtitle="Size atanmış Kabul ve Ders Protokolü ve ders kayıt formu imzaları. Ayrıntıyı incelemek için öğrenci kaydını açın."
      />
      <Page>
        {items.length === 0 && <Empty>İmzanızı bekleyen form yok.</Empty>}
        <div className="space-y-3">
          {items.map((a) => (
            <Card key={a.id} className="space-y-3 p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-su-subtle">
                    {a.subject.label} · {LABELS.track[a.enrollment.type]} · {a.enrollment.programName}
                  </p>
                  <h2 className="text-base font-semibold">
                    {a.enrollment.fullName} <span className="text-sm font-normal text-su-subtle">{a.enrollment.studentNo}</span>
                  </h2>
                  <p className="text-sm text-su-muted">
                    {a.subject.courseCount} ders · {a.subject.ects} AKTS{a.subject.termId ? ` · ${a.subject.termId}` : ''} · {a.subject.round}. tur · gönderim{' '}
                    {fmtDateTime(a.createdAt)}
                  </p>
                </div>
                <Badge tone="warn">İmzanız: {a.roleLabel}</Badge>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <Link href={`/kayitlar/${a.enrollment.id}`} className="text-sm">
                  Kaydı ve formu incele
                </Link>
                {a.subject.kind === 'PROTOCOL' && (
                  <Link href={`/yazdir/protokol/${a.enrollment.id}`} className="text-sm">
                    Yazdırılabilir form
                  </Link>
                )}
              </div>
              <ActionForm action={decideApprovalAction} className="rounded-lg bg-su-bg p-3">
                <input type="hidden" name="approvalId" value={a.id} />
                <Field label="Açıklama" hint="Ret için zorunlu; formu koordinatöre geri gönderir.">
                  <Input name="comment" />
                </Field>
                <div className="flex flex-wrap gap-2">
                  <SubmitButton size="sm" name="decision" value="APPROVED">
                    {a.role === 'OGRENCI_IMZA' ? 'Öğrencinin ıslak imzası alındı' : 'Onayla'}
                  </SubmitButton>
                  <SubmitButton size="sm" variant="outline" name="decision" value="REJECTED" confirm="Form reddedilecek ve koordinatöre geri dönecek. Devam edilsin mi?">
                    Reddet
                  </SubmitButton>
                </div>
              </ActionForm>
            </Card>
          ))}
        </div>
      </Page>
    </>
  );
}
