import Link from 'next/link';
import { LABELS, type ApplicationStatus, type TrackType } from '@cap/contracts';
import { ApplicationBadge, EnrollmentBadge, FormBadge } from '@/components/status';
import { Badge, Card, Empty, Page, PageHero, Table, Td, Th } from '@/components/ui';
import { api } from '@/lib/api';
import { fmtGpa } from '@/lib/format';
import type { EnrollmentListRow } from '@/lib/types';

export const metadata = { title: 'Öğrencilerim' };

interface Advisee {
  studentNo: string;
  fullName: string;
  gano: number;
  semesterNo: number;
  relation: 'ANA_DAL' | 'PROGRAM';
  enrollments: EnrollmentListRow[];
  applications: { id: string; status: ApplicationStatus; programName: string; type: TrackType }[];
}

/** Ana dal danışmanlığı ve ÇAP/yan dal program danışmanlığı (Danışmanlık Yön. m.6/5, m.7). */
export default async function Advisor() {
  const list = await api<Advisee[]>('/advisor/students');
  return (
    <>
      <PageHero
        title="Öğrencilerim"
        crumbs={['Kayıtlı öğrenciler']}
        subtitle="Ana dal danışmanı ya da ÇAP / yan dal program danışmanı olduğunuz öğrenciler. İmza bekleyen formlar Onaylarım sayfasındadır."
      />
      <Page>
        <Card>
          {list.length === 0 ? (
            <Empty>Danışmanı olduğunuz öğrenci yok.</Empty>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Öğrenci</Th>
                  <Th>Danışmanlık</Th>
                  <Th>GNO / yarıyıl</Th>
                  <Th>Kayıtlar</Th>
                  <Th>Başvurular</Th>
                </tr>
              </thead>
              <tbody>
                {list.map((s) => (
                  <tr key={s.studentNo}>
                    <Td>
                      <p className="font-medium">{s.fullName}</p>
                      <p className="text-xs text-su-subtle">{s.studentNo}</p>
                    </Td>
                    <Td>
                      <Badge tone={s.relation === 'ANA_DAL' ? 'neutral' : 'accent'}>{s.relation === 'ANA_DAL' ? 'Ana dal' : 'Program'}</Badge>
                    </Td>
                    <Td>
                      {fmtGpa(s.gano)} · {s.semesterNo}.
                    </Td>
                    <Td>
                      {s.enrollments.length === 0 ? (
                        <span className="text-xs text-su-subtle">—</span>
                      ) : (
                        <ul className="space-y-1">
                          {s.enrollments.map((e) => (
                            <li key={e.id} className="flex flex-wrap items-center gap-1 text-xs">
                              <Link href={`/kayitlar/${e.id}`}>
                                {LABELS.track[e.type]}: {e.program.name}
                              </Link>
                              <EnrollmentBadge value={e.status} />
                              <FormBadge value={e.protocolStatus} />
                              {e.warnings.some((w) => w.decision === 'PENDING') && <Badge tone="warn">Uyarı</Badge>}
                            </li>
                          ))}
                        </ul>
                      )}
                    </Td>
                    <Td>
                      {s.applications.length === 0 ? (
                        <span className="text-xs text-su-subtle">—</span>
                      ) : (
                        <ul className="space-y-1">
                          {s.applications.map((a) => (
                            <li key={a.id} className="flex flex-wrap items-center gap-1 text-xs">
                              {a.programName} <ApplicationBadge value={a.status} />
                            </li>
                          ))}
                        </ul>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </Page>
    </>
  );
}
