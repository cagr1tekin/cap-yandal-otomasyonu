import { SIGNERS } from '@cap/contracts';
import { Parties, PrintShell, Signatures } from '@/components/print';
import { api } from '@/lib/api';
import { fmtDate } from '@/lib/format';
import type { EnrollmentDetail } from '@/lib/types';

export const metadata = { title: 'Özel Şartlı Derslerin Muafiyeti Formu' };

/** Rehberdeki "Özel Şartlı Derslerin Muafiyeti Formu"nun yazdırılabilir karşılığı (2 nüsha). */
export default async function PrintExemption({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ sart?: string }> }) {
  const [{ id }, { sart }] = await Promise.all([params, searchParams]);
  const d = await api<EnrollmentDetail>(`/enrollments/${id}`);
  const x = d.exemptions.find((e) => e.id === sart && e.request);
  const title = 'ÖZEL ŞARTLI DERSLERİN MUAFİYETİ FORMU';
  if (!x?.request) return <PrintShell title={title}>
      <p className="mt-6 text-center">Bu özel şart için muafiyet başvurusu yok.</p>
    </PrintShell>;

  return (
    <PrintShell
      title={title}
      note={
        <>
          <p>Not: Bu form iki nüsha olarak düzenlenecek,</p>
          <ul className="ml-4 list-['-_']">
            <li>Bir tanesi öğrenci,</li>
            <li>Bir tanesi de çift anadal koordinatörlüğü tarafından saklanacaktır.</li>
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
          ['ÇİFT ANADAL', ''],
          ['Fakültesi', d.enrollment.program.faculty],
          ['Bölümü/Anabilim Dalı', d.enrollment.program.name],
        ]}
      />
      <p className="mt-5">
        Kabul ve Ders Protokolümün <strong>{x.no}</strong> numaralı özel şartını sağladığımdan, aşağıdaki dersten muaf sayılmamı arz ederim.
      </p>
      <table className="mt-3 w-full border-collapse border border-black">
        <thead>
          <tr className="border-b border-black text-left">
            <th className="border-r border-black px-2 py-1">Ana dalda alınan ders</th>
            <th className="w-28 border-r border-black px-2 py-1">Dönem</th>
            <th className="w-16 border-r border-black px-2 py-1">Not</th>
            <th className="px-2 py-1">Muaf sayılacak ders</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border-r border-black px-2 py-1.5">
              {x.sourceCourseCode} {x.sourceCourseName}
            </td>
            <td className="border-r border-black px-2 py-1.5">{x.request.sourceTerm}</td>
            <td className="border-r border-black px-2 py-1.5">{x.request.sourceGrade}</td>
            <td className="px-2 py-1.5">
              {x.targetCourseCode} {x.targetCourseName}
            </td>
          </tr>
        </tbody>
      </table>
      {x.note && <p className="mt-2 text-[12px]">Şart notu: {x.note}</p>}
      <Signatures approvals={x.approvals} roles={SIGNERS.EXEMPTION} labels={{ ANA_DAL_DANISMANI: 'Anadal Danışmanı', KOORDINATOR: 'Çift Anadal Koordinatörü' }} />
      <p className="mt-4 text-right">Tarih: {fmtDate(x.request.approvedAt ?? x.request.createdAt)}</p>
    </PrintShell>
  );
}
