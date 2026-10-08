import type { ReactNode } from 'react';
import { LABELS, type ApprovalRole } from '@cap/contracts';
import { PrintButton } from '@/components/print-button';
import { fmtDate } from '@/lib/format';
import type { Approval } from '@/lib/types';

/** Kâğıt formun karşılığı: üniversite başlığı, form adı ve yazdır düğmesi. */
export function PrintShell({ title, children, note }: { title: string; children: ReactNode; note?: ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl bg-white p-8 text-[13px] leading-relaxed text-black print:max-w-none print:p-0">
      <div className="no-print mb-6 flex justify-end">
        <PrintButton />
      </div>
      <p className="text-center text-base font-semibold tracking-wide">SELÇUK ÜNİVERSİTESİ</p>
      <h1 className="mt-1 text-center text-base font-semibold uppercase text-black">{title}</h1>
      {children}
      {note && <div className="mt-6 text-xs">{note}</div>}
      <p className="mt-6 border-t border-slate-300 pt-2 text-[10px] text-slate-500">
        Bu form Bilgisayar Mühendisliği ÇAP / Yan Dal Otomasyonunda (bitirme projesi) çevrim içi imzalanmıştır; imza bilgileri sistemin değiştirilemez denetim kaydındadır.
      </p>
    </div>
  );
}

/** Formun üstündeki iki sütunlu öğrenci / program kutusu. */
export function Parties({ left, right }: { left: [string, string][]; right: [string, string][] }) {
  const col = (rows: [string, string][]) => (
    <div className="space-y-0.5">
      {rows.map(([k, v]) =>
        v === '' ? (
          <p key={k} className="pt-1 font-semibold">
            {k}
          </p>
        ) : (
          <p key={k}>
            <span className="font-semibold">{k}:</span> {v}
          </p>
        ),
      )}
    </div>
  );
  return (
    <div className="mt-5 grid grid-cols-2 gap-6 border border-black p-3">
      {col(left)}
      {col(right)}
    </div>
  );
}

/** İmza kutuları: son imza turundaki her imzacı için ad, durum ve tarih. */
export function Signatures({ approvals, roles, labels }: { approvals: Approval[]; roles: ApprovalRole[]; labels?: Partial<Record<ApprovalRole, string>> }) {
  const round = approvals.length ? Math.max(...approvals.map((a) => a.round)) : 0;
  const of = (role: ApprovalRole) => approvals.find((a) => a.round === round && a.role === role);
  return (
    <div className="mt-8 grid grid-cols-3 gap-x-4 gap-y-6 text-center">
      {roles.map((role) => {
        const a = of(role);
        return (
          <div key={role}>
            <p className="font-semibold">{labels?.[role] ?? LABELS.approvalRole[role]}</p>
            <div className="mt-1 min-h-14 border border-dashed border-slate-400 px-1 py-1.5 text-[11px]">
              {a?.decision === 'APPROVED' ? (
                <>
                  <p>{a.comment?.startsWith('Islak imza') ? 'Islak imza (koordinatör işledi)' : `e-imza: ${a.decidedBy}`}</p>
                  <p>{fmtDate(a.decidedAt)}</p>
                </>
              ) : a?.decision === 'REJECTED' ? (
                <p>Reddedildi</p>
              ) : (
                <p className="text-slate-400">İmza bekleniyor</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
