import { SIGNERS } from '@cap/contracts';
import { Parties, PrintShell, Signatures } from '@/components/print';
import { api } from '@/lib/api';
import { fmtDate } from '@/lib/format';
import type { EnrollmentDetail } from '@/lib/types';

export const metadata = { title: 'Kabul ve Ders Protokol Formu' };

/** "Çift Anadal / Yan Dal Kabul ve Ders Protokol Formu"nun yazdırılabilir karşılığı. */
export default async function PrintProtocol({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await api<EnrollmentDetail>(`/enrollments/${id}`);
  const cap = d.enrollment.type === 'CAP';
  const word = cap ? 'ÇİFT ANADAL' : 'YAN DAL';
  const p = d.protocol;
  if (!p) return <PrintShell title={`${word} KABUL ve DERS PROTOKOL FORMU`}>
      <p className="mt-6 text-center">Protokol henüz hazırlanmadı.</p>
    </PrintShell>;
  const total = p.courses.reduce((t, c) => t + c.ects, 0);
  const conditions = d.exemptions;
  const footnote = (code: string | null) => conditions.filter((c) => c.targetCourseCode === code).map((c) => c.no);

  return (
    <PrintShell
      title={`${word} KABUL ve DERS PROTOKOL FORMU`}
      note={
        <>
          <p>Not: Bu form dört nüsha olarak düzenlenecek,</p>
          <ul className="ml-4 list-['-_']">
            <li>Bir tanesi öğrenci,</li>
            <li>Bir tanesi anadal danışmanı,</li>
            <li>Bir tanesi {cap ? 'çift anadal' : 'yan dal'} koordinatörü,</li>
            <li>Bir tanesi de {cap ? 'çift anadal' : 'yan dal'} bölüm/anabilim dalı başkanlığı tarafından saklanacaktır.</li>
          </ul>
        </>
      }
    >
      <Parties
        left={[
          ['Öğrenci No', d.student.studentNo],
          ['Adı Soyadı', d.student.fullName],
          ['ANADAL', ''],
          ['Fakültesi', d.student.mainFaculty],
          ['Bölümü/Anabilim Dalı', d.student.mainProgram],
        ]}
        right={[
          [word, ''],
          ['Fakültesi', d.enrollment.program.faculty],
          ['Bölümü/Anabilim Dalı', d.enrollment.program.name],
        ]}
      />
      <p className="mt-5 text-center font-semibold">ÖĞRENCİNİN {word} PROGRAMINDA ALACAĞI DERSLER</p>
      <table className="mt-2 w-full border-collapse border border-black">
        <thead>
          <tr className="border-b border-black text-left">
            <th className="w-24 border-r border-black px-2 py-1">Ders Kodu</th>
            <th className="w-20 border-r border-black px-2 py-1">Kredisi (AKTS)</th>
            <th className="px-2 py-1">Ders Adı</th>
          </tr>
        </thead>
        <tbody>
          {p.courses.map((c) => (
            <tr key={c.id} className="border-b border-slate-300">
              <td className="border-r border-black px-2 py-0.5">{c.code ?? ''}</td>
              <td className="border-r border-black px-2 py-0.5">{c.ects}</td>
              <td className="px-2 py-0.5">
                {c.name.toLocaleUpperCase('tr')}
                {footnote(c.code).map((n) => (
                  <sup key={n}>{n}</sup>
                ))}
                {c.status === 'EXEMPT' && <span className="ml-2 text-[11px]">(muaf{c.fulfilledName ? `: ${c.fulfilledName}` : ''})</span>}
              </td>
            </tr>
          ))}
          <tr>
            <td className="border-r border-black px-2 py-1" />
            <td className="border-r border-black px-2 py-1 font-semibold">{total}</td>
            <td className="px-2 py-1 text-[11px]">{p.commonEcts > 0 && `Ana dalda alınan ortak derslerle birlikte ${total + p.commonEcts} AKTS`}</td>
          </tr>
        </tbody>
      </table>
      {conditions.length > 0 && (
        <ol className="mt-3 space-y-1 text-[12px]">
          {conditions.map((c) => (
            <li key={c.id}>
              <sup>{c.no}</sup> Öğrenci {d.student.mainProgram} bölümünden {c.sourceCourseCode} kodlu {c.sourceCourseName} dersini alırsa {c.targetCourseCode} kodlu {c.targetCourseName} dersinden muaf
              sayılacaktır.{c.note && ` (${c.note})`}
            </li>
          ))}
        </ol>
      )}
      <Signatures
        approvals={p.approvals}
        roles={SIGNERS.PROTOCOL}
        labels={{
          ANA_DAL_DANISMANI: 'Anadal Danışmanı',
          ANA_DAL_BOLUM_BASKANI: 'Anadal Bölüm/Anabilim Dalı Başkanı',
          KOORDINATOR: `${cap ? 'Çift Anadal' : 'Yan Dal'} Koordinatörü`,
          CAP_BOLUM_BASKANI: `${cap ? 'Çift Anadal' : 'Yan Dal'} Bölüm/Anabilim Dalı Başkanı`,
        }}
      />
      <p className="mt-4 text-right">Tarih: {fmtDate(p.approvedAt ?? p.submittedAt)}</p>
    </PrintShell>
  );
}
