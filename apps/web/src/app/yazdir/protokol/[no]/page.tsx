import { notFound } from 'next/navigation';
import { Parties, PrintShell, Signatures } from '@/components/print';
import { api } from '@/lib/api';
import type { StudentCard } from '@/lib/types';

export const metadata = { title: 'Kabul ve Ders Protokol Formu' };

/** Öğrencinin onaylı ders listesiyle doldurulmuş Kabul ve Ders Protokol Formu (ana dalda imzalatılır). */
export default async function PrintProtocol({ params }: { params: Promise<{ no: string }> }) {
  const { no } = await params;
  if (!/^\d{9}$/.test(no)) notFound();
  const c = await api<StudentCard>(`/students/${no}`);
  const s = c.student;
  const cap = s.track === 'CAP';
  const word = cap ? 'ÇİFT ANADAL' : 'YAN DAL';
  const items = c.planItems.filter((i) => i.status === 'APPROVED' && !i.removedAt);
  const total = items.reduce((t, i) => t + i.ects, 0);
  const template = c.templates.find((t) => t.sourceProgramId === s.mainProgramId);

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
          ['Öğrenci No', s.studentNo],
          ['Adı Soyadı', s.fullName],
          ['ANADAL', ''],
          ['Fakültesi', s.mainProgram?.faculty ?? ''],
          ['Bölümü/Anabilim Dalı', s.mainProgram?.name ?? ''],
        ]}
        right={[
          [word, ''],
          ['Fakültesi', 'Teknoloji Fakültesi'],
          ['Bölümü/Anabilim Dalı', 'Bilgisayar Mühendisliği'],
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
          {items.map((i) => (
            <tr key={i.id} className="border-b border-slate-300">
              <td className="border-r border-black px-2 py-0.5">{i.courseCode ?? ''}</td>
              <td className="border-r border-black px-2 py-0.5">{i.ects}</td>
              <td className="px-2 py-0.5">
                {i.name.toLocaleUpperCase('tr')}
                {template?.conditions
                  .filter((k) => k.targetCourseCode === i.courseCode)
                  .map((k) => (
                    <sup key={k.no}>{k.no}</sup>
                  ))}
              </td>
            </tr>
          ))}
          <tr>
            <td className="border-r border-black px-2 py-1" />
            <td className="border-r border-black px-2 py-1 font-semibold">{total}</td>
            <td className="px-2 py-1 text-[11px]">{cap && s.commonEcts > 0 && `Ana dalda alınan ortak derslerle birlikte ${total + s.commonEcts} AKTS`}</td>
          </tr>
        </tbody>
      </table>
      {template && template.conditions.length > 0 && (
        <ol className="mt-3 space-y-1 text-[12px]">
          {template.conditions.map((k) => (
            <li key={k.no}>
              <sup>{k.no}</sup> Öğrenci {s.mainProgram?.name} bölümünden {k.sourceCourseCode} kodlu {k.sourceCourseName} dersini alırsa {k.targetCourseCode} kodlu dersten muaf sayılacaktır.
            </li>
          ))}
        </ol>
      )}
      <Signatures
        labels={['Öğrenci', 'Anadal Danışmanı', 'Anadal Bölüm/Anabilim Dalı Başkanı', `${cap ? 'Çift Anadal' : 'Yan Dal'} Koordinatörü`, `${cap ? 'Çift Anadal' : 'Yan Dal'} Bölüm/Anabilim Dalı Başkanı`]}
      />
      <p className="mt-4 text-right">Tarih: ..... / ..... / ..........</p>
    </PrintShell>
  );
}
