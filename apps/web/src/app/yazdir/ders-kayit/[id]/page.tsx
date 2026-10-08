import { SIGNERS } from '@cap/contracts';
import { Parties, PrintShell, Signatures } from '@/components/print';
import { api } from '@/lib/api';
import { fmtDate } from '@/lib/format';
import type { EnrollmentDetail } from '@/lib/types';

export const metadata = { title: 'Ders Kayıt Formu' };

/** FORM01 "Çift Anadal Ders Kayıt Formu" / "Yan Dal Ders Kayıt Formu"nun yazdırılabilir karşılığı. */
export default async function PrintCourseRegistration({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ donem?: string }> }) {
  const [{ id }, { donem }] = await Promise.all([params, searchParams]);
  const d = await api<EnrollmentDetail>(`/enrollments/${id}`);
  const cap = d.enrollment.type === 'CAP';
  const word = cap ? 'ÇİFT ANADAL' : 'YAN DAL';
  const r = d.courseRegistrations.find((x) => x.termId === (donem ?? d.currentTerm?.id)) ?? d.courseRegistrations[0];
  if (!r) return <PrintShell title={`${word} DERS KAYIT FORMU`}>
      <p className="mt-6 text-center">Ders kayıt formu henüz hazırlanmadı.</p>
    </PrintShell>;

  return (
    <PrintShell
      title={`${word} DERS KAYIT FORMU`}
      note={
        <>
          <p>Not: Bu form üç nüsha olarak düzenlenecek,</p>
          <ul className="ml-4 list-['-_']">
            <li>Bir tanesi öğrenci,</li>
            <li>Bir tanesi {cap ? 'çift anadal' : 'yan dal'} programının bulunduğu fakülte öğrenci işleri,</li>
            <li>Bir tanesi de {cap ? 'çift anadal' : 'yan dal'} koordinatörlüğü tarafından saklanacaktır.</li>
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
          ['Yarıyıl', `${r.term.year} ${r.term.season === 'GUZ' ? 'güz' : 'bahar'} Y.Y.`],
        ]}
      />
      <table className="mt-5 w-full border-collapse border border-black">
        <thead>
          <tr className="border-b border-black text-left">
            <th className="w-24 border-r border-black px-2 py-1">Ders Kodu</th>
            <th className="w-20 border-r border-black px-2 py-1">Kredisi (AKTS)</th>
            <th className="px-2 py-1">Ders Adı</th>
          </tr>
        </thead>
        <tbody>
          {r.items.map((i) => (
            <tr key={i.id} className="border-b border-slate-300">
              <td className="border-r border-black px-2 py-1">{i.code}</td>
              <td className="border-r border-black px-2 py-1">{i.ects}</td>
              <td className="px-2 py-1">
                {i.name.toLocaleUpperCase('tr')}
                {i.protocolCourse.kind === 'ELECTIVE_SLOT' && <span className="ml-2 text-[11px]">({i.protocolCourse.name})</span>}
              </td>
            </tr>
          ))}
          <tr>
            <td className="border-r border-black px-2 py-1" />
            <td className="border-r border-black px-2 py-1 font-semibold">{r.items.reduce((t, i) => t + i.ects, 0)}</td>
            <td />
          </tr>
        </tbody>
      </table>
      <Signatures approvals={r.approvals} roles={SIGNERS.COURSE_REG} labels={{ ANA_DAL_DANISMANI: 'Anadal Danışmanı', KOORDINATOR: `${cap ? 'Çift Anadal' : 'Yan Dal'} Koordinatörü` }} />
      <p className="mt-4 text-right">Tarih: {fmtDate(r.approvedAt ?? r.submittedAt)}</p>
    </PrintShell>
  );
}
