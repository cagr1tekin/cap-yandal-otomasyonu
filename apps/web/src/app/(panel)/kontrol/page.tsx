import Link from 'next/link';
import { LABELS, type StudentStatus, type TrackType } from '@cap/contracts';
import type { RuleResult } from '@cap/rules';
import { ActionForm, SubmitButton } from '@/components/forms';
import { StudentStatusBadge, WorstBadge } from '@/components/status';
import { Badge, Card, CardTitle, Empty, Page, PageHero, Table, Td, Th } from '@/components/ui';
import { runAllChecksAction } from '@/lib/actions';
import { api } from '@/lib/api';
import { fmtDateTime } from '@/lib/format';
import { getMe } from '@/lib/me';

export const metadata = { title: 'Kural kontrolü' };

interface Row {
  studentNo: string;
  fullName: string;
  track: TrackType;
  status: StudentStatus;
  lastCheck: { id: string; at: string; worst: 'OK' | 'WARN' | 'FAIL'; version: string; graduationReady: boolean; flagged: RuleResult[] } | null;
}

/**
 * Yönerge kurallarına göre öğrencilerin durumu (son kayıtlı kontrol). Uyarı karar değildir:
 * mezuniyet, sertifika ve kayıt silme kararı öğrenci kartından koordinatörce verilir.
 */
export default async function Checks() {
  const [rows, me] = await Promise.all([api<Row[]>('/checks'), getMe()]);
  const order = { FAIL: 0, WARN: 1, OK: 3 } as const;
  const sorted = [...rows].sort((a, b) => (a.lastCheck?.graduationReady ? -1 : 0) - (b.lastCheck?.graduationReady ? -1 : 0) || (order[a.lastCheck?.worst ?? 'OK'] ?? 2) - (order[b.lastCheck?.worst ?? 'OK'] ?? 2));
  return (
    <>
      <PageHero
        title="Kural kontrolü ve kararlar"
        crumbs={['Öğrenci takibi']}
        subtitle="Kontroller onay, not, GANO ve liste değişikliklerinde kendiliğinden çalışır ve kullanılan kural sürümüyle saklanır. Yalnızca onaylı kayıtlar hesaba girer."
        actions={
          me?.role === 'KOORDINATOR' && (
            <ActionForm action={runAllChecksAction}>
              <SubmitButton variant="accent" pending="Kontrol ediliyor…">
                Tüm öğrencileri şimdi kontrol et
              </SubmitButton>
            </ActionForm>
          )
        }
      />
      <Page>
        <Card>
          <CardTitle>Etkin ve dondurulmuş öğrenciler</CardTitle>
          {sorted.length === 0 ? (
            <Empty>Öğrenci yok.</Empty>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Öğrenci</Th>
                  <Th>Durum</Th>
                  <Th>Son kontrol</Th>
                  <Th>Bulgular</Th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => (
                  <tr key={r.studentNo}>
                    <Td>
                      <Link href={`/ogrenciler/${r.studentNo}`} className="font-medium">
                        {r.fullName}
                      </Link>
                      <span className="block text-xs text-su-subtle">
                        {r.studentNo} · {LABELS.trackShort[r.track]}
                      </span>
                    </Td>
                    <Td>
                      <StudentStatusBadge value={r.status} />
                    </Td>
                    <Td className="text-xs">
                      {r.lastCheck ? (
                        <>
                          <WorstBadge value={r.lastCheck.worst} /> <span className="block">{fmtDateTime(r.lastCheck.at)} · {r.lastCheck.version}</span>
                        </>
                      ) : (
                        <WorstBadge value={null} />
                      )}
                    </Td>
                    <Td className="text-sm">
                      {r.lastCheck?.graduationReady && <Badge tone="accent">{r.track === 'CAP' ? 'Mezuniyete hazır: karar bekliyor' : 'Sertifikaya hazır: karar bekliyor'}</Badge>}
                      <ul className="mt-1 space-y-0.5">
                        {r.lastCheck?.flagged.map((f) => (
                          <li key={f.code} className={f.status === 'FAIL' ? 'text-bad' : 'text-warn'}>
                            {f.title}: {f.message}
                          </li>
                        ))}
                      </ul>
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
