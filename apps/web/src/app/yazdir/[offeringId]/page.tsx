import { LABELS } from '@cap/contracts';
import { PrintButton } from './print-button';
import { api } from '@/lib/api';
import { fmtDate, fmtGpa, termLabel } from '@/lib/format';
import type { ReviewData } from '@/lib/types';

export const metadata = { title: 'Yazdırılabilir liste' };

/** FR-18: birim web sitesinde yayımlanabilir sonuç listesi (kişisel veri en aza indirilmiş). */
export default async function PrintList({ params }: { params: Promise<{ offeringId: string }> }) {
  const { offeringId } = await params;
  const d = await api<ReviewData>(`/offerings/${offeringId}/applications`);
  const o = d.offering;
  const listed = d.rows.filter((r) => ['ACCEPTED', 'ENROLLED', 'WAITLISTED', 'NOT_ENROLLED'].includes(r.status));
  // Yayımlanan listede ad soyad yerine maskelenmiş ad ve numaranın son 4 hanesi kullanılır.
  const mask = (name: string) =>
    name
      .split(' ')
      .map((p) => `${p[0]}${'*'.repeat(Math.max(2, p.length - 1))}`)
      .join(' ');

  return (
    <div className="mx-auto max-w-3xl bg-white p-8 print:p-0">
      <div className="no-print mb-6 flex justify-end">
        <PrintButton />
      </div>
      <p className="text-center text-xs uppercase tracking-[0.2em] text-su-muted">T.C. Selçuk Üniversitesi · {o.program.unit.name}</p>
      <h1 className="mt-2 text-center text-xl font-semibold">
        {termLabel(o.term)} {o.program.name} {LABELS.track[o.type]} Programı Sonuç Listesi
      </h1>
      {d.decision && (
        <p className="mt-1 text-center text-sm text-su-muted">
          Yönetim Kurulu Kararı: {fmtDate(d.decision.decisionDate)} / {d.decision.decisionNo}
        </p>
      )}
      <table className="mt-6 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-su-heading text-left">
            <th className="py-2">Sıra</th>
            <th>Öğrenci</th>
            <th>Numara</th>
            <th>GNO</th>
            <th>Sonuç</th>
          </tr>
        </thead>
        <tbody>
          {listed.map((r) => (
            <tr key={r.id} className="border-b border-su-border">
              <td className="py-1.5">{r.ranking?.rank}</td>
              <td>{mask(r.fullName)}</td>
              <td>*****{r.studentNo.slice(-4)}</td>
              <td>{fmtGpa(r.gano)}</td>
              <td>{r.status === 'WAITLISTED' ? 'Yedek' : 'Asil'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-6 text-xs text-su-muted">
        Asil adayların kesin kaydı OBİS üzerinden yapılır. Bu liste bitirme projesi kapsamında üretilmiştir; resmî ilan değildir.
      </p>
    </div>
  );
}
