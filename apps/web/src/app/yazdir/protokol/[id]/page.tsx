import { LABELS } from '@cap/contracts';
import { PrintButton } from '@/components/print-button';
import { api } from '@/lib/api';
import { fmtDateTime } from '@/lib/format';
import type { EnrollmentDetail } from '@/lib/types';

export const metadata = { title: 'Kabul ve Ders Protokol Formu' };

/**
 * Selçuk Üniversitesi "Çift Ana Dal / Yan Dal Kabul ve Ders Protokol Formu"nun düzeni (kaynaklar/mevcut-surec).
 * Panelde alınan onaylar imza kutularında gösterilir; kâğıt nüsha ıslak imza için de basılabilir.
 */
export default async function ProtocolPrint({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await api<EnrollmentDetail>(`/enrollments/${id}`);
  const p = d.protocol;
  const track = d.enrollment.type === 'CAP' ? 'ÇİFT ANA DAL' : 'YAN DAL';
  const round = p?.approvals.length ? Math.max(...p.approvals.map((a) => a.round)) : 0;
  const sig = (role: string) => p?.approvals.find((a) => a.round === round && a.role === role);
  const box = (role: keyof typeof LABELS.approvalRole) => {
    const a = sig(role);
    return (
      <td className="h-24 w-1/3 border border-su-heading p-2 align-top text-xs">
        <p className="font-semibold">{LABELS.approvalRole[role]}</p>
        <p className="text-su-muted">{a?.assigneeUsername ?? ''}</p>
        {a?.decision === 'APPROVED' && (
          <p className="mt-2 text-ok">
            Panelde onaylandı
            <br />
            {fmtDateTime(a.decidedAt)}
          </p>
        )}
        <p className="mt-4">İmza:</p>
      </td>
    );
  };

  return (
    <div className="mx-auto max-w-3xl bg-white p-8 text-sm print:p-0">
      <div className="no-print mb-6 flex justify-end">
        <PrintButton />
      </div>
      <p className="text-center font-semibold">SELÇUK ÜNİVERSİTESİ</p>
      <h1 className="text-center text-base font-semibold">{track} KABUL ve DERS PROTOKOL FORMU</h1>
      <table className="mt-4 w-full border-collapse">
        <tbody>
          <tr>
            <td className="border border-su-heading p-2">Öğrenci No: {d.student.studentNo}</td>
            <td className="border border-su-heading p-2" rowSpan={2}>
              <b>{track}</b>
              <br />
              Fakültesi: {d.enrollment.program.unitName}
              <br />
              Bölümü / Programı: {d.enrollment.program.name}
            </td>
          </tr>
          <tr>
            <td className="border border-su-heading p-2">
              Adı Soyadı: {d.student.fullName}
              <br />
              <b>ANA DAL</b> Fakültesi: {d.student.mainUnit}
              <br />
              Bölümü: {d.student.mainProgram}
            </td>
          </tr>
        </tbody>
      </table>
      <p className="mt-4 font-semibold">ÖĞRENCİNİN {track} PROGRAMINDA ALACAĞI DERSLER</p>
      <table className="mt-1 w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className="border border-su-heading p-1 text-left">Ders Kodu</th>
            <th className="border border-su-heading p-1 text-left">Ders Adı</th>
            <th className="border border-su-heading p-1">AKTS</th>
          </tr>
        </thead>
        <tbody>
          {(p?.courses ?? []).map((c) => (
            <tr key={c.code}>
              <td className="border border-su-heading p-1 font-mono">{c.code}</td>
              <td className="border border-su-heading p-1">{c.name}</td>
              <td className="border border-su-heading p-1 text-center">{c.ects}</td>
            </tr>
          ))}
          {p && p.commonEcts > 0 && (
            <tr>
              <td className="border border-su-heading p-1" colSpan={2}>
                Ana dalda alınan ve iki program için ortak kabul edilen dersler (Yönerge m.7/2)
              </td>
              <td className="border border-su-heading p-1 text-center">{p.commonEcts}</td>
            </tr>
          )}
          <tr>
            <td className="border border-su-heading p-1 text-right font-semibold" colSpan={2}>
              Toplam
            </td>
            <td className="border border-su-heading p-1 text-center font-semibold">
              {(p?.courses.reduce((t, c) => t + c.ects, 0) ?? 0) + (p?.commonEcts ?? 0)}
            </td>
          </tr>
        </tbody>
      </table>
      <table className="mt-6 w-full border-collapse">
        <tbody>
          <tr>
            {box('OGRENCI_IMZA')}
            {box('ANA_DAL_DANISMANI')}
            {box('ANA_DAL_BOLUM_BASKANI')}
          </tr>
          <tr>
            {box('KOORDINATOR')}
            {box('HEDEF_BOLUM_BASKANI')}
            <td className="border border-su-heading p-2 align-top text-xs">
              Tarih:
              <br />
              {p?.approvedAt ? fmtDateTime(p.approvedAt) : ''}
              <br />
              Durum: {p ? LABELS.form[p.status] : '—'} ({round}. tur)
            </td>
          </tr>
        </tbody>
      </table>
      <p className="mt-3 text-xs">
        Not: Bu form dört nüsha olarak düzenlenir; öğrenci, ana dal danışmanı, koordinatör ve {track.toLocaleLowerCase('tr')} bölüm başkanlığı birer nüsha saklar.
        Aslı öğrenci işlerindeki öğrenci dosyasında bulunur.
      </p>
    </div>
  );
}
