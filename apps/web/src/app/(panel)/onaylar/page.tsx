import Link from 'next/link';
import { LABELS } from '@cap/contracts';
import { ActionForm, SubmitButton } from '@/components/forms';
import { Badge, Card, Empty, Field, Input, Page, PageHero } from '@/components/ui';
import { api } from '@/lib/api';
import { fmtDateTime } from '@/lib/format';
import { decideApprovalAction } from '@/lib/actions';
import type { MyApproval } from '@/lib/types';

export const metadata = { title: 'İmzalarım' };

const printPath = (a: MyApproval) =>
  a.subject.kind === 'PROTOCOL' ? `/yazdir/protokol/${a.enrollment.id}` : a.subject.kind === 'COURSE_REG' ? `/yazdir/ders-kayit/${a.enrollment.id}` : null;

/** Kâğıt formların imza turunun karşılığı: kullanıcının atması beklenen imzalar. */
export default async function Approvals() {
  const items = await api<MyApproval[]>('/approvals/mine');
  return (
    <>
      <PageHero
        title="İmzalarım"
        subtitle="İmzanızı bekleyen Kabul ve Ders Protokolü, ders kayıt formu ve özel şartlı ders muafiyeti formları. Ayrıntıyı incelemek için öğrenci kaydını açın."
      />
      <Page>
        {items.length === 0 && <Empty>İmzanızı bekleyen form yok.</Empty>}
        <div className="space-y-3">
          {items.map((a) => (
            <Card key={a.id} className="space-y-3 p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-su-subtle">
                    {a.subject.label} · {LABELS.track[a.enrollment.type]} · ana dal: {a.enrollment.mainProgramName}
                  </p>
                  <h2 className="text-base font-semibold">
                    {a.enrollment.fullName} <span className="text-sm font-normal text-su-subtle">{a.enrollment.studentNo}</span>
                  </h2>
                  <p className="text-sm text-su-muted">{a.subject.summary}</p>
                  <p className="text-xs text-su-subtle">
                    {a.subject.round}. tur · gönderim {fmtDateTime(a.createdAt)}
                  </p>
                </div>
                <Badge tone="warn">{a.proxy ? `Islak imza: ${a.roleLabel}` : `İmzanız: ${a.roleLabel}`}</Badge>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <Link href={`/kayitlar/${a.enrollment.id}`} className="text-sm">
                  Kaydı ve formu incele
                </Link>
                {printPath(a) && (
                  <Link href={printPath(a)!} className="text-sm">
                    Yazdırılabilir form
                  </Link>
                )}
              </div>
              {a.proxy && (
                <p className="rounded-lg bg-warn-soft px-3 py-2 text-xs text-warn">
                  Bu imzacının sistemde hesabı yok. Yazdırılan formda ıslak imzası alındıysa buradan işleyin; işlem sizin adınıza denetim kaydına yazılır.
                </p>
              )}
              <ActionForm action={decideApprovalAction} className="rounded-lg bg-su-bg p-3">
                <input type="hidden" name="approvalId" value={a.id} />
                <Field label="Açıklama" hint="Ret için zorunlu; form hazırlayana geri döner.">
                  <Input name="comment" />
                </Field>
                <div className="flex flex-wrap gap-2">
                  <SubmitButton size="sm" name="decision" value="APPROVED">
                    {a.proxy ? 'Islak imza alındı' : 'İmzala'}
                  </SubmitButton>
                  <SubmitButton size="sm" variant="outline" name="decision" value="REJECTED" confirm="Form reddedilecek ve yeni imza turu gerekecek. Devam edilsin mi?">
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
