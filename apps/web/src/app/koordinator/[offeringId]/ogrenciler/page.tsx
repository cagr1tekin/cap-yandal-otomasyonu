import { LABELS } from '@cap/contracts';
import { ActionForm, SubmitButton } from '@/components/forms';
import { EnrollmentBadge } from '@/components/status';
import { Badge, Card, Empty, Page, PageHero, Table, Td, Th } from '@/components/ui';
import { api } from '@/lib/api';
import { fmtDate } from '@/lib/format';
import { approvePlanAction } from '@/lib/staff-actions';
import type { EnrollmentView, OfferingRow } from '@/lib/types';

export const metadata = { title: 'Kayıtlı öğrenciler' };

export default async function Students({ params }: { params: Promise<{ offeringId: string }> }) {
  const { offeringId } = await params;
  const d = await api<{ offering: OfferingRow; items: EnrollmentView[] }>(`/offerings/${offeringId}/enrollments`);
  const risky = d.items.filter((e) => e.warnings.some((w) => w.decision === 'PENDING'));

  return (
    <>
      <PageHero
        title={`${d.offering.program.name} — kayıtlı öğrenciler`}
        crumbs={['Koordinatörlük', LABELS.track[d.offering.type]]}
        subtitle={`${d.items.length} kayıt · ${risky.length} öğrenci için karar bekleyen uyarı`}
      />
      <Page>
        <Card>
          {d.items.length === 0 ? (
            <Empty>Bu programda kayıtlı öğrenci yok.</Empty>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Öğrenci</Th>
                  <Th>Durum</Th>
                  <Th>Kayıt</Th>
                  <Th>Uyarılar</Th>
                  {d.offering.type === 'YANDAL' && <Th>Ders planı</Th>}
                </tr>
              </thead>
              <tbody>
                {d.items.map((e) => (
                  <tr key={e.id}>
                    <Td>
                      <p className="font-medium">{e.fullName}</p>
                      <p className="text-xs text-su-subtle">{e.studentNo}</p>
                    </Td>
                    <Td>
                      <EnrollmentBadge value={e.status} />
                      {e.ganoStrikes > 0 && <p className="mt-1 text-xs text-warn">GNO düşüşü: {e.ganoStrikes}</p>}
                    </Td>
                    <Td>{fmtDate(e.createdAt)}</Td>
                    <Td>
                      {e.warnings.length === 0 ? (
                        <span className="text-xs text-su-subtle">—</span>
                      ) : (
                        <ul className="space-y-1">
                          {e.warnings.map((w) => (
                            <li key={w.id} className="text-xs">
                              <Badge tone={w.status === 'FAIL' ? 'bad' : 'warn'}>{w.ruleCode}</Badge> {w.result.message}{' '}
                              <span className="text-su-subtle">({LABELS.finding[w.decision as 'PENDING']})</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </Td>
                    {d.offering.type === 'YANDAL' && (
                      <Td>
                        {e.plan.length === 0 ? (
                          <span className="text-xs text-su-subtle">Plan girilmedi</span>
                        ) : (
                          <div className="space-y-1 text-xs">
                            <p>
                              {e.plan.length} ders · {e.plan.reduce((t, p) => t + p.course.ects, 0)} AKTS
                            </p>
                            <p className="text-su-muted">{e.plan.map((p) => p.course.courseCode).join(', ')}</p>
                            {e.plan.every((p) => p.status === 'APPROVED') ? (
                              <Badge tone="ok">Onaylı</Badge>
                            ) : (
                              <ActionForm action={approvePlanAction}>
                                <input type="hidden" name="enrollmentId" value={e.id} />
                                <SubmitButton size="sm">Planı onayla</SubmitButton>
                              </ActionForm>
                            )}
                          </div>
                        )}
                      </Td>
                    )}
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
