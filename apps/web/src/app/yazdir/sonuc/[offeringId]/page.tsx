import { LABELS, type Proposal } from '@cap/contracts';
import { PrintShell } from '@/components/print';
import { api } from '@/lib/api';
import { fmtDate, fmtGpa, termLabel } from '@/lib/format';
import type { Decision, OfferingRow } from '@/lib/types';

export const metadata = { title: 'Sonuç listesi' };

interface Result {
  offering: OfferingRow;
  decision: Decision;
  rows: { rank: number; studentNo: string; fullName: string; mainProgramName: string; gano: number; proposal: Proposal }[];
}

/** İlan edilecek sonuç listesi: öğrenci numarası ve ad API'de maskelenir (fakülte ilanlarındaki uygulama). */
export default async function PrintResult({ params }: { params: Promise<{ offeringId: string }> }) {
  const { offeringId } = await params;
  const d = await api<Result>(`/offerings/${offeringId}/result`);
  return (
    <PrintShell title={`${termLabel(d.offering.term)} Bilgisayar Mühendisliği ${LABELS.track[d.offering.type]} Programı Sonuç Listesi`}>
      <p className="mt-1 text-center text-xs">
        Teknoloji Fakültesi Yönetim Kurulu Kararı: {fmtDate(d.decision.decisionDate)} / {d.decision.decisionNo} · Kontenjan: {d.offering.quota}
      </p>
      <table className="mt-6 w-full border-collapse">
        <thead>
          <tr className="border-b-2 border-black text-left">
            <th className="py-1.5">Sıra</th>
            <th>Öğrenci No</th>
            <th>Adı Soyadı</th>
            <th>Ana Dal</th>
            <th>GNO</th>
            <th>Sonuç</th>
          </tr>
        </thead>
        <tbody>
          {d.rows.map((r) => (
            <tr key={r.rank} className="border-b border-slate-300">
              <td className="py-1.5">{r.rank}</td>
              <td>{r.studentNo}</td>
              <td>{r.fullName}</td>
              <td>{r.mainProgramName}</td>
              <td>{fmtGpa(r.gano)}</td>
              <td>{LABELS.proposal[r.proposal]}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-6 text-xs">
        Asil adaylar kesin kayıtlarını sistemde “Başvuru” sayfasından onaylar
        {d.offering.registrationDeadline && ` (son gün ${fmtDate(d.offering.registrationDeadline)})`}. Kaydını onaylamayan asilin yerine sıradaki yedek çağrılır
        {d.offering.waitlistDeadline && ` (yedek son gün ${fmtDate(d.offering.waitlistDeadline)})`}.
      </p>
    </PrintShell>
  );
}
