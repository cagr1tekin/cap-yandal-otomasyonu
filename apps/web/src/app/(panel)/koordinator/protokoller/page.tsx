import Link from 'next/link';
import { LABELS } from '@cap/contracts';
import { TemplateForm } from '@/components/template-form';
import { Badge, buttonVariants, Card, CardTitle, Page, PageHero, Table, Td, Th } from '@/components/ui';
import { api } from '@/lib/api';
import { fmtDate } from '@/lib/format';
import { getMe, hasRole } from '@/lib/me';
import type { Course, Program, Template } from '@/lib/types';

export const metadata = { title: 'Protokol şablonları' };

/** Bölümler arası ÇAP protokolleri ve yan dal ders havuzu. Öğrencinin protokolü buradaki şablondan üretilir. */
export default async function Templates() {
  const [templates, me] = await Promise.all([api<Template[]>('/protocol-templates'), getMe()]);
  const canEdit = hasRole(me, 'KOORDINATOR');
  const [courses, programs] = canEdit ? await Promise.all([api<Course[]>('/courses'), api<Program[]>('/programs')]) : [[], []];
  const used = templates.filter((t) => t.type === 'CAP').map((t) => t.sourceProgramId!);
  const hasMinor = templates.some((t) => t.type === 'YANDAL');

  return (
    <>
      <PageHero
        title="Protokol şablonları"
        crumbs={['Kayıtlı öğrenciler']}
        subtitle="Çift ana dalda her ana dal bölümü için bir Kabul ve Ders Protokolü vardır: alınacak dersler, teknik seçmeli ders yerleri ve özel şartlar. Yan dalda tek ders havuzu kullanılır."
      />
      <Page>
        <Card>
          <Table>
            <thead>
              <tr>
                <Th>Tür</Th>
                <Th>Protokol</Th>
                <Th>Satır</Th>
                <Th>AKTS</Th>
                <Th>Özel şart</Th>
                <Th>Kural</Th>
                <Th>Kaynak</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id}>
                  <Td>{LABELS.track[t.type]}</Td>
                  <Td className="font-medium">
                    {t.title}
                    <span className="block text-xs font-normal text-su-subtle">
                      {t._count?.protocols ?? 0} öğrenci protokolü · güncelleme {fmtDate(t.updatedAt)}
                    </span>
                  </Td>
                  <Td>{t.items.length}</Td>
                  <Td>
                    {t.ects}
                    {t.commonEcts > 0 && <span className="block text-xs text-su-muted">+ {t.commonEcts} ortak = {t.totalEcts}</span>}
                  </Td>
                  <Td>{t.conditions.length}</Td>
                  <Td>{t.ok ? <Badge tone="ok">Sağlanıyor</Badge> : <Badge tone="bad">Sağlanmıyor</Badge>}</Td>
                  <Td className="max-w-56 text-xs text-su-muted">{t.source ?? `Komisyon (${t.updatedBy})`}</Td>
                  <Td>
                    <Link href={`/koordinator/protokoller/${t.id}`} className={buttonVariants({ size: 'sm', variant: 'outline' })}>
                      Aç
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
        {canEdit && (
          <Card>
            <CardTitle>Yeni çift ana dal protokolü</CardTitle>
            <details>
              <summary className="text-sm font-medium text-su-primary">Başka bir ana dal bölümü için protokol tanımla</summary>
              <div className="mt-4">
                <TemplateForm type="CAP" courses={courses} programs={programs} usedProgramIds={used} />
              </div>
            </details>
          </Card>
        )}
        {canEdit && !hasMinor && (
          <Card>
            <CardTitle>Yan dal ders havuzu</CardTitle>
            <TemplateForm type="YANDAL" courses={courses} programs={programs} usedProgramIds={[]} />
          </Card>
        )}
      </Page>
    </>
  );
}
