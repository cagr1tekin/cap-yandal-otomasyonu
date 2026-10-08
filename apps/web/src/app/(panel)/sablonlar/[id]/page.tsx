import { LABELS } from '@cap/contracts';
import { RuleList } from '@/components/status';
import { TemplateForm } from '@/components/template-form';
import { Alert, Card, CardTitle, Page, PageHero, Stat, Table, Td, Th } from '@/components/ui';
import { api } from '@/lib/api';
import { getMe, hasRole } from '@/lib/me';
import type { Course, Program, Template } from '@/lib/types';

export const metadata = { title: 'Protokol şablonu' };

export default async function TemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [t, courses, programs, me] = await Promise.all([api<Template>(`/protocol-templates/${id}`), api<Course[]>('/courses'), api<Program[]>('/programs'), getMe()]);
  const canEdit = hasRole(me, 'KOORDINATOR');
  const name = (code: string) => courses.find((c) => c.code === code)?.name ?? code;

  return (
    <>
      <PageHero title={t.title} crumbs={['Tanımlar', 'Ders listesi şablonları', LABELS.track[t.type]]} subtitle={t.source ?? undefined} />
      <Page>
        <div className="grid gap-3 sm:grid-cols-4">
          <Stat label="Satır" value={t.items.length} hint={`${t.items.filter((i) => i.kind === 'ELECTIVE_SLOT').length} teknik seçmeli ders yeri`} />
          <Stat label="Protokol AKTS" value={t.ects} />
          <Stat label={t.type === 'CAP' ? 'Ortak AKTS ile toplam' : 'Havuz AKTS'} value={t.totalEcts} hint={t.type === 'CAP' ? `${t.commonEcts} AKTS ana dalda ortak` : 'Yan dal ders listesi'} />
          <Stat label="Özel şart" value={t.conditions.length} />
        </div>
        <Card>
          <CardTitle>Kural denetimi</CardTitle>
          <RuleList results={t.results} />
        </Card>
        <Card>
          <CardTitle>Dersler</CardTitle>
          <Table>
            <thead>
              <tr>
                <Th>Ders kodu</Th>
                <Th>AKTS</Th>
                <Th>Ders adı</Th>
                <Th>Yarıyıl</Th>
              </tr>
            </thead>
            <tbody>
              {t.items.map((i) => (
                <tr key={i.id}>
                  <Td className="font-mono text-xs">{i.code ?? '—'}</Td>
                  <Td>{i.ects}</Td>
                  <Td>{i.name}</Td>
                  <Td>{i.semester}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          {t.conditions.length > 0 && (
            <ol className="mt-4 space-y-1.5 text-sm">
              {t.conditions.map((c) => (
                <li key={c.id}>
                  <sup>{c.no}</sup> Öğrenci {t.sourceProgram?.name} bölümünden <span className="font-mono text-xs">{c.sourceCourseCode}</span> kodlu {c.sourceCourseName} dersini alırsa{' '}
                  <span className="font-mono text-xs">{c.targetCourseCode}</span> kodlu {name(c.targetCourseCode)} dersinden muaf sayılacaktır.
                  {c.note && <span className="text-su-muted"> ({c.note})</span>}
                </li>
              ))}
            </ol>
          )}
        </Card>
        {canEdit && (
          <Card>
            <CardTitle>Şablonu düzenle</CardTitle>
            <Alert tone="info" className="mb-4" title="Şablon değişikliği yalnızca bundan sonra oluşturulacak listeleri etkiler; öğrencilerin mevcut listeleri ve notları değişmez." />
            <TemplateForm template={t} type={t.type} courses={courses} programs={programs} usedProgramIds={[]} />
          </Card>
        )}
      </Page>
    </>
  );
}
