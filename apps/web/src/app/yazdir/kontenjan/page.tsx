import { LABELS, type TrackType } from '@cap/contracts';
import { PrintButton } from '@/components/print-button';
import { api } from '@/lib/api';
import { termLabel } from '@/lib/format';
import type { OfferingRow, Term } from '@/lib/types';

export const metadata = { title: 'Kontenjan ve koordinatörler' };

/**
 * ÖİDB'nin her dönem PDF olarak yayımladığı "Programlar, kontenjanları ve koordinatörleri" tablosunun
 * yayımlanmış tekliflerden üretilmiş hâli. Kaynak bölüm kısıtları dipnot olarak verilir (ilandaki gibi).
 */
export default async function QuotaList({ searchParams }: { searchParams: Promise<{ donem?: string; tur?: string }> }) {
  const sp = await searchParams;
  const terms = await api<Term[]>('/terms');
  const term = terms.find((t) => t.id === sp.donem) ?? terms.find((t) => t.isCurrent)!;
  const type: TrackType = sp.tur === 'YANDAL' ? 'YANDAL' : 'CAP';
  const offerings = (await api<OfferingRow[]>(`/offerings?termId=${term.id}&type=${type}`)).filter((o) => o.status === 'PUBLISHED');
  const units = [...new Set(offerings.map((o) => o.program.unit.name))].sort((a, b) => a.localeCompare(b, 'tr'));
  const notes: string[] = [];
  const noteOf = (o: OfferingRow) => {
    if (!o.sourcePrograms.length) return '';
    const text = `${o.sourcePrograms.map((s) => s.program.name).join(', ')} bölümünden öğrenci kabul edilecektir.`;
    let i = notes.indexOf(text);
    if (i < 0) i = notes.push(text) - 1;
    return String(i + 1);
  };

  return (
    <div className="mx-auto max-w-4xl bg-white p-8 print:p-0">
      <div className="no-print mb-6 flex justify-end">
        <PrintButton />
      </div>
      <h1 className="text-center text-lg font-semibold uppercase">
        {termLabel(term)} yarıyılı {LABELS.track[type]} programları, kontenjanları ve koordinatörleri
      </h1>
      <table className="mt-6 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-su-heading text-left">
            <th className="py-2">Birim</th>
            <th>Program</th>
            <th className="text-center">Kontenjan</th>
            <th>Koordinatör</th>
          </tr>
        </thead>
        <tbody>
          {units.flatMap((u) =>
            offerings
              .filter((o) => o.program.unit.name === u)
              .map((o, i) => (
                <tr key={o.id} className="border-b border-su-border align-top">
                  <td className="py-1.5 pr-2">{i === 0 ? u : ''}</td>
                  <td>
                    {o.program.name}
                    {noteOf(o) && <sup className="ml-0.5">{noteOf(o)}</sup>}
                  </td>
                  <td className="text-center">{o.quota}</td>
                  <td>{o.coordinatorUsername}</td>
                </tr>
              )),
          )}
        </tbody>
      </table>
      {notes.length > 0 && (
        <ol className="mt-4 list-decimal space-y-0.5 pl-5 text-xs">
          {notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ol>
      )}
      <p className="mt-6 text-xs text-su-muted">Bu tablo bitirme projesi kapsamında yayımlanmış tekliflerden üretilmiştir; resmî ilan değildir.</p>
    </div>
  );
}
