import { redirect } from 'next/navigation';
import { Card, CardTitle, Page, PageHero, Table, Td, Th } from '@/components/ui';
import { api } from '@/lib/api';
import { fmtDateTime } from '@/lib/format';
import { getMe } from '@/lib/me';
import { LABELS, type ImportKind } from '@cap/contracts';
import { ImportForm } from './form';

export const metadata = { title: 'İçeri aktar' };

/**
 * Dışarıdan veri aktarımı. Satırlar elle girişle aynı servis yöntemlerinden geçer (doğrulama, onay,
 * işlem kaydı). Önce deneme yapılır; hiçbir şey yazılmadan satır satır sonuç gösterilir.
 * İleride OBİS bağlantısı bu yolu kullanır.
 */
export default async function ImportPage() {
  const me = await getMe();
  if (me?.role !== 'KOORDINATOR') redirect('/panel');
  const batches = await api<{ id: string; kind: ImportKind; rowCount: number; okCount: number; createdBy: string; createdAt: string }[]>('/imports');
  return (
    <>
      <PageHero title="İçeri aktar (CSV)" crumbs={['Tanımlar']} subtitle="Ders kataloğu, mevcut öğrenciler ve geçmiş dönem dersleri toplu girilebilir. Anahtar öğrenci numarası ve ders kodudur." />
      <Page>
        <ImportForm />
        <Card>
          <CardTitle>Biçimler (ayraç ; ya da ,)</CardTitle>
          <ul className="space-y-2 font-mono text-xs">
            <li>
              <b>Ders kataloğu:</b> code;name;ects;semester;kind;credit — kind: ZORUNLU, TEKNIK_SECMELI, SOSYAL_SECMELI
            </li>
            <li>
              <b>Öğrenciler:</b> studentNo;fullName;schoolEmail;track;admissionTermId;mainProgramId;commonEcts — track: CAP / YANDAL, dönem: T-2025-GUZ
            </li>
            <li>
              <b>Geçmiş dersler:</b> studentNo;courseCode;termId;grade — ders listede yoksa listeye de eklenir; not boş olabilir
            </li>
          </ul>
        </Card>
        <Card>
          <CardTitle>Önceki aktarımlar</CardTitle>
          <Table>
            <thead>
              <tr>
                <Th>Zaman</Th>
                <Th>Tür</Th>
                <Th>Satır</Th>
                <Th>İşlenen</Th>
                <Th>Yapan</Th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.id}>
                  <Td className="text-xs">{fmtDateTime(b.createdAt)}</Td>
                  <Td>{LABELS.importKind[b.kind]}</Td>
                  <Td>{b.rowCount}</Td>
                  <Td>{b.okCount}</Td>
                  <Td className="text-xs">{b.createdBy}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </Page>
    </>
  );
}
