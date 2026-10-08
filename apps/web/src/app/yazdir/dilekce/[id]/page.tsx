import { LABELS } from '@cap/contracts';
import { PrintShell } from '@/components/print';
import { api } from '@/lib/api';
import { fmtDate, fmtGpa, termLabel } from '@/lib/format';
import type { ApplicationDetail } from '@/lib/types';

export const metadata = { title: 'Başvuru dilekçesi' };

/** Çevrim içi başvurudan üretilen dilekçe: Rehberdeki "öğrenci başvuru dilekçesi"nin karşılığı. */
export default async function PrintPetition({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await api<ApplicationDetail>(`/applications/${id}`);
  const d = a.snapshot.declared;
  const cap = a.offering.type === 'CAP';
  const percent = d.classRank && d.classSize ? Math.round((d.classRank / d.classSize) * 1000) / 10 : null;
  const rows: [string, string][] = [
    ['Öğrenci numarası', a.studentNo],
    ['Adı soyadı', a.snapshot.fullName],
    ['Ana dal fakültesi / bölümü', `${a.student.program.faculty} / ${a.student.program.name}`],
    ['Başlayacağı yarıyıl', `${d.semesterNo}.`],
    ['Genel not ortalaması', fmtGpa(d.gano)],
    ['Sınıf başarı sırası', d.classRank ? `${d.classRank} / ${d.classSize} (ilk %${String(percent).replace('.', ',')})` : 'Beyan edilmedi'],
    ['Kayıt yılı ve YKS yerleştirme puanı', `${d.entryYear} · ${d.entryScore != null ? String(d.entryScore).replace('.', ',') : '—'}`],
    ['YKS başarı sırası', d.successRank != null ? d.successRank.toLocaleString('tr-TR') : '—'],
    ['E-posta / telefon', [a.student.email, a.student.phone].filter(Boolean).join(' / ')],
  ];

  return (
    <PrintShell title={`${cap ? 'ÇİFT ANADAL' : 'YAN DAL'} PROGRAMI BAŞVURU DİLEKÇESİ`}>
      <p className="mt-6 text-center font-semibold">TEKNOLOJİ FAKÜLTESİ DEKANLIĞINA</p>
      <p className="mt-4 indent-8 text-justify">
        {termLabel(a.offering.term)} yarıyılında Fakülteniz Bilgisayar Mühendisliği Bölümü {LABELS.track[a.offering.type].toLocaleLowerCase('tr')} programına başvurmak istiyorum. Aşağıdaki bilgilerin
        transkriptimdeki ve YKS belgemdeki değerlerle aynı olduğunu beyan eder, gereğini arz ederim.
      </p>
      <table className="mt-5 w-full border-collapse border border-black">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k} className="border-b border-slate-300">
              <th className="w-64 border-r border-black px-2 py-1 text-left font-semibold">{k}</th>
              <td className="px-2 py-1">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-4 font-semibold">Ekler</p>
      <ul className="ml-5 list-disc">
        {a.documents.map((doc) => (
          <li key={doc.id}>
            {LABELS.document[doc.kind]} ({doc.fileName})
          </li>
        ))}
        {a.documents.length === 0 && <li>—</li>}
      </ul>
      <div className="mt-10 flex justify-end">
        <div className="text-center">
          <p>{fmtDate(a.submittedAt)}</p>
          <p className="mt-1 font-semibold">{a.snapshot.fullName}</p>
          <p className="text-[11px]">Çevrim içi başvuru no: {a.id}</p>
        </div>
      </div>
    </PrintShell>
  );
}
