import { LABELS, type TrackType } from '@cap/contracts';
import { Badge, Card, CardTitle, Empty, Page, PageHero, Progress, Stat, Table, Td, Th } from '@/components/ui';
import { api } from '@/lib/api';
import { termLabel } from '@/lib/format';
import type { Term, WindowState } from '@/lib/types';

export const metadata = { title: 'Raporlar' };

interface Summary {
  term: Term | null;
  rows: { offeringId: string; type: TrackType; quota: number; window: WindowState; applications: number; ineligible: number; accepted: number; waitlisted: number; enrolled: number; fillRate: number }[];
  enrollments: { type: TrackType; active: number; completed: number; withdrawn: number; removed: number }[];
  byProgram: { programName: string; cap: number; yandal: number }[];
  pendingFindings: number;
}

export default async function Reports() {
  const d = await api<Summary>('/reports/summary');
  const total = (k: 'active' | 'completed' | 'withdrawn' | 'removed') => d.enrollments.reduce((t, e) => t + e[k], 0);
  return (
    <>
      <PageHero title="Raporlar" crumbs={['Yönetim', d.term ? termLabel(d.term) : '']} subtitle="Dönem başvuruları, kontenjan doluluğu ve kayıtlı öğrencilerin durumu." />
      <Page>
        <div className="grid gap-3 sm:grid-cols-4">
          <Stat label="Etkin öğrenci" value={total('active')} hint="Çift ana dal + yan dal" />
          <Stat label="Tamamlayan" value={total('completed')} />
          <Stat label="Ayrılan / kaydı silinen" value={`${total('withdrawn')} / ${total('removed')}`} />
          <Stat label="Karar bekleyen bulgu" value={d.pendingFindings} />
        </div>
        <Card>
          <CardTitle>Bu dönemin başvuruları</CardTitle>
          {d.rows.length === 0 ? (
            <Empty>Bu dönem için teklif yok.</Empty>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {d.rows.map((r) => (
                <div key={r.offeringId} className="rounded-xl border border-su-border/70 p-4">
                  <h3 className="mb-2 text-base font-semibold">{LABELS.track[r.type]}</h3>
                  <Progress value={r.accepted} max={r.quota} label="Kontenjan doluluğu (kabul / kontenjan)" />
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <dt className="text-su-muted">Başvuru</dt>
                    <dd className="font-medium">{r.applications}</dd>
                    <dt className="text-su-muted">Koşulları sağlamayan</dt>
                    <dd className="font-medium">{r.ineligible}</dd>
                    <dt className="text-su-muted">Yedek</dt>
                    <dd className="font-medium">{r.waitlisted}</dd>
                    <dt className="text-su-muted">Kesin kayıt</dt>
                    <dd className="font-medium">{r.enrolled}</dd>
                  </dl>
                </div>
              ))}
            </div>
          )}
        </Card>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardTitle>Kayıt durumları</CardTitle>
            <Table>
              <thead>
                <tr>
                  <Th>Tür</Th>
                  <Th>Etkin</Th>
                  <Th>Tamamlayan</Th>
                  <Th>Ayrılan</Th>
                  <Th>Kaydı silinen</Th>
                </tr>
              </thead>
              <tbody>
                {d.enrollments.map((e) => (
                  <tr key={e.type}>
                    <Td className="font-medium">{LABELS.track[e.type]}</Td>
                    <Td>{e.active}</Td>
                    <Td>{e.completed}</Td>
                    <Td>{e.withdrawn}</Td>
                    <Td>{e.removed}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
          <Card>
            <CardTitle>Ana dal bölümüne göre etkin öğrenciler</CardTitle>
            <Table>
              <thead>
                <tr>
                  <Th>Ana dal bölümü</Th>
                  <Th>Çift ana dal</Th>
                  <Th>Yan dal</Th>
                </tr>
              </thead>
              <tbody>
                {d.byProgram.map((p) => (
                  <tr key={p.programName}>
                    <Td>{p.programName}</Td>
                    <Td>{p.cap || <Badge tone="muted">0</Badge>}</Td>
                    <Td>{p.yandal || <Badge tone="muted">0</Badge>}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </div>
      </Page>
    </>
  );
}
