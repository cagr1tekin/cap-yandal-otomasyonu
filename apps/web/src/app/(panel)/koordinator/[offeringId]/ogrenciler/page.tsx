import Link from 'next/link';
import { LABELS } from '@cap/contracts';
import { EnrollmentBadge, FormBadge } from '@/components/status';
import { Badge, Card, Empty, Page, PageHero, Table, Td, Th } from '@/components/ui';
import { api } from '@/lib/api';
import { fmtDate, termLabel } from '@/lib/format';
import type { EnrollmentListRow, OfferingRow, Term } from '@/lib/types';

export const metadata = { title: 'Kayıtlı öğrenciler' };

export default async function Students({ params }: { params: Promise<{ offeringId: string }> }) {
  const { offeringId } = await params;
  const d = await api<{ offering: OfferingRow; currentTerm: Term | null; items: EnrollmentListRow[] }>(`/offerings/${offeringId}/enrollments`);
  const pending = d.items.filter((e) => e.warnings.some((w) => w.decision === 'PENDING')).length;

  return (
    <>
      <PageHero
        title={`${d.offering.program.name} — kayıtlı öğrenciler`}
        crumbs={['Koordinatörlük', LABELS.track[d.offering.type]]}
        subtitle={`${d.items.length} kayıt · ${pending} öğrenci için karar bekleyen uyarı`}
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
                  <Th>Protokol</Th>
                  <Th>Ders kaydı {d.currentTerm ? `(${termLabel(d.currentTerm)})` : ''}</Th>
                  <Th>Uyarılar</Th>
                </tr>
              </thead>
              <tbody>
                {d.items.map((e) => (
                  <tr key={e.id}>
                    <Td>
                      <Link href={`/kayitlar/${e.id}`} className="font-medium">
                        {e.fullName}
                      </Link>
                      <p className="text-xs text-su-subtle">{e.studentNo}</p>
                    </Td>
                    <Td>
                      <EnrollmentBadge value={e.status} />
                    </Td>
                    <Td>{fmtDate(e.createdAt)}</Td>
                    <Td>
                      <FormBadge value={e.protocolStatus} />
                    </Td>
                    <Td>
                      <FormBadge value={e.currentRegistrationStatus} />
                    </Td>
                    <Td>
                      {e.warnings.length === 0 ? (
                        <span className="text-xs text-su-subtle">—</span>
                      ) : (
                        e.warnings.map((w) => (
                          <Badge key={w.id} tone={w.status === 'FAIL' ? 'bad' : 'warn'} className="mr-1">
                            {w.ruleCode}
                          </Badge>
                        ))
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
