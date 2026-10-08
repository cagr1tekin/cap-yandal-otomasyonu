import type { ReactNode } from 'react';
import { PrintButton } from '@/components/print-button';

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
        Sistemdeki onaylı kayıtlarla doldurulmuştur. İmzalar öğrencinin ana dalında ıslak imzayla alınır; imzalı form taranıp sisteme yüklenir.
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

/** Boş imza kutuları (kâğıtta doldurulur). */
export function Signatures({ labels }: { labels: string[] }) {
  return (
    <div className="mt-8 grid grid-cols-3 gap-x-4 gap-y-6 text-center">
      {labels.map((l) => (
        <div key={l}>
          <p className="font-semibold">{l}</p>
          <div className="mt-1 h-14 border border-dashed border-slate-400" />
          <p className="text-[11px]">İmza</p>
        </div>
      ))}
    </div>
  );
}
