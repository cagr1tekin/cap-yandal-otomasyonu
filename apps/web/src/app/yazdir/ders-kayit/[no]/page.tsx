import { notFound } from 'next/navigation';
import { Parties, PrintShell, Signatures } from '@/components/print';
import { api } from '@/lib/api';
import type { StudentCard } from '@/lib/types';

export const metadata = { title: 'Ders Kayıt Formu' };

/** Dönemde girilen derslerle doldurulmuş FORM01 (ana dalda imzalatılır, taranıp yüklenir). */
export default async function PrintCourseRegistration({ params, searchParams }: { params: Promise<{ no: string }>; searchParams: Promise<{ donem?: string }> }) {
  const [{ no }, { donem }] = await Promise.all([params, searchParams]);
  if (!/^\d{9}$/.test(no)) notFound();
  const c = await api<StudentCard>(`/students/${no}`);
  const s = c.student;
  const cap = s.track === 'CAP';
  const word = cap ? 'ÇİFT ANADAL' : 'YAN DAL';
  const term = c.terms.find((t) => t.id === donem) ?? c.currentTerm;
  const attempts = c.planItems.flatMap((i) => i.attempts.filter((a) => a.termId === term?.id && (a.status === 'PENDING' || a.status === 'APPROVED')));

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
          ['Yarıyıl', term ? `${term.year} ${term.season === 'GUZ' ? 'güz' : 'bahar'} Y.Y.` : ''],
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
          {attempts.map((a) => (
            <tr key={a.id} className="border-b border-slate-300">
              <td className="border-r border-black px-2 py-1">{a.courseCode}</td>
              <td className="border-r border-black px-2 py-1">{a.ects}</td>
              <td className="px-2 py-1">{a.courseName.toLocaleUpperCase('tr')}</td>
            </tr>
          ))}
          {attempts.length === 0 && (
            <tr>
              <td colSpan={3} className="px-2 py-3 text-center text-slate-500">
                Bu dönem için girilmiş ders yok.
              </td>
            </tr>
          )}
          <tr>
            <td className="border-r border-black px-2 py-1" />
            <td className="border-r border-black px-2 py-1 font-semibold">{attempts.reduce((t, a) => t + a.ects, 0)}</td>
            <td />
          </tr>
        </tbody>
      </table>
      <Signatures labels={['Öğrenci', 'Anadal Danışmanı', `${cap ? 'Çift Anadal' : 'Yan Dal'} Koordinatörü`]} />
      <p className="mt-4 text-right">Tarih: ..... / ..... / ..........</p>
    </PrintShell>
  );
}
