import Link from 'next/link';
import { LABELS } from '@cap/contracts';
import { EnrollmentBadge, FormBadge } from '@/components/status';
import { Badge, Empty, Table, Td, Th } from '@/components/ui';
import { termLabel } from '@/lib/format';
import type { EnrollmentListRow } from '@/lib/types';

/** Kayıtlı öğrenci listesi: komisyon, ana dal imzacıları ve öğrencinin kendi kayıtları için ortak tablo. */
export function EnrollmentTable({ rows, empty, own = false }: { rows: EnrollmentListRow[]; empty: string; own?: boolean }) {
  if (rows.length === 0) return <Empty>{empty}</Empty>;
  return (
    <Table>
      <thead>
        <tr>
          <Th>{own ? 'Program' : 'Öğrenci'}</Th>
          {!own && <Th>Ana dal</Th>}
          <Th>Başlangıç</Th>
          <Th>Durum</Th>
          <Th>Protokol</Th>
          <Th>Bu dönem ders kaydı</Th>
          <Th>İlerleme</Th>
          <Th>Uyarı</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((e) => (
          <tr key={e.id}>
            <Td>
              <Link href={`/kayitlar/${e.id}`} className="font-medium">
                {own ? `Bilgisayar Mühendisliği ${LABELS.track[e.type]}` : e.fullName}
              </Link>
              {!own && (
                <span className="block text-xs text-su-subtle">
                  {e.studentNo} · {LABELS.track[e.type]}
                </span>
              )}
            </Td>
            {!own && <Td>{e.mainProgramName}</Td>}
            <Td className="text-xs">{termLabel(e.term)}</Td>
            <Td>
              <EnrollmentBadge value={e.status} />
              {e.ganoStrikes > 0 && <span className="mt-1 block text-[11px] text-warn">GNO düşüşü: {e.ganoStrikes}</span>}
            </Td>
            <Td>
              <FormBadge value={e.protocolStatus} />
            </Td>
            <Td>
              <FormBadge value={e.currentRegistrationStatus} />
            </Td>
            <Td className="text-xs">{e.requiredEcts ? `${e.trackEcts} / ${e.requiredEcts} AKTS` : '—'}</Td>
            <Td>
              {e.warnings.filter((w) => w.decision === 'PENDING').length > 0 ? (
                <Badge tone={e.warnings.some((w) => w.status === 'FAIL' && w.decision === 'PENDING') ? 'bad' : 'warn'}>{e.warnings.filter((w) => w.decision === 'PENDING').length} bulgu</Badge>
              ) : (
                <span className="text-xs text-su-subtle">—</span>
              )}
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
