import Link from 'next/link';
import { CalendarClock, ChevronDown, Users } from 'lucide-react';
import { LABELS, type TrackType } from '@cap/contracts';
import { ApplicationBadge, RuleList, VerdictBadge } from '@/components/status';
import { Alert, Badge, buttonVariants, Card, Empty, Page, PageHero } from '@/components/ui';
import { api } from '@/lib/api';
import { cn, fmtDateTime, fmtGpa, termLabel } from '@/lib/format';
import type { Eligibility, EligibilityItem } from '@/lib/types';

export const metadata = { title: 'Programlar' };

function windowText(w: EligibilityItem['window']) {
  if (w.phase === 'ACIK') return `Başvuru açık · son gün ${fmtDateTime(w.closesAt)}`;
  if (w.phase === 'ONCE') return `Başvuru ${fmtDateTime(w.opensAt)} tarihinde açılacak`;
  if (w.phase === 'KAPANDI') return 'Başvuru dönemi kapandı';
  return 'Başvuru takvimi henüz ilan edilmedi';
}

function OfferingCard({ item }: { item: EligibilityItem }) {
  const canApply = item.window.open && item.verdict !== 'INELIGIBLE' && !item.application;
  const failed = item.results.filter((r) => r.status === 'FAIL' || r.status === 'CONDITIONAL');
  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-su-subtle">{item.offering.unitName}</p>
          <h3 className="text-base font-semibold text-su-heading">{item.offering.programName}</h3>
        </div>
        <VerdictBadge value={item.verdict} />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-su-muted">
        <span className="inline-flex items-center gap-1">
          <Users aria-hidden className="size-3.5" /> Kontenjan {item.offering.quota}
        </span>
        <span className="inline-flex items-center gap-1">
          <CalendarClock aria-hidden className="size-3.5" /> {windowText(item.window)}
        </span>
        {item.offering.type === 'YANDAL' && <span>Ders havuzu {item.offering.poolEcts} AKTS</span>}
      </div>
      {item.offering.sourcePrograms.length > 0 && (
        <p className="text-xs text-su-muted">
          <span className="font-medium">Kabul edilen bölümler:</span> {item.offering.sourcePrograms.join(', ')}
        </p>
      )}
      {failed.length > 0 && (
        <ul className="space-y-1 text-sm">
          {failed.map((r) => (
            <li key={r.code} className={cn(r.status === 'FAIL' ? 'text-bad' : 'text-warn')}>
              {r.message} <span className="text-xs text-su-subtle">({r.article})</span>
            </li>
          ))}
        </ul>
      )}
      <details className="group rounded-lg bg-su-bg px-3 py-2">
        <summary className="flex items-center justify-between text-sm font-medium text-su-primary">
          Tüm koşullar <ChevronDown aria-hidden className="size-4 transition-transform group-open:rotate-180" />
        </summary>
        <RuleList results={item.results} hideNa />
      </details>
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
        {item.application ? (
          <>
            <ApplicationBadge value={item.application.status} />
            <Link href="/ogrenci/basvurularim" className="text-sm">
              Başvuruyu gör
            </Link>
          </>
        ) : canApply ? (
          <Link href={`/ogrenci/basvuru/${item.offering.id}`} className={buttonVariants({ size: 'sm' })}>
            {item.verdict === 'CONDITIONAL' ? 'Belgeyle başvur' : 'Başvur'}
          </Link>
        ) : (
          <span className="text-xs text-su-subtle">{item.verdict === 'INELIGIBLE' ? 'Koşullar sağlanmıyor' : 'Başvuru dönemi dışında'}</span>
        )}
      </div>
    </Card>
  );
}

export default async function Programs({ searchParams }: { searchParams: Promise<{ tur?: string; filtre?: string }> }) {
  const sp = await searchParams;
  const type: TrackType = sp.tur === 'YANDAL' ? 'YANDAL' : 'CAP';
  const filter = sp.filtre === 'uygun' ? 'uygun' : 'hepsi';
  const data = await api<Eligibility>(`/me/eligibility?type=${type}`);
  const items = filter === 'uygun' ? data.items.filter((i) => i.verdict !== 'INELIGIBLE') : data.items;
  const eligibleCount = data.items.filter((i) => i.verdict !== 'INELIGIBLE').length;
  const s = data.student;

  const tab = (t: TrackType) => (
    <Link
      href={`?tur=${t}${filter === 'uygun' ? '&filtre=uygun' : ''}`}
      aria-current={type === t ? 'page' : undefined}
      className={cn(buttonVariants({ variant: type === t ? 'accent' : 'outline', size: 'sm' }), 'no-underline')}
    >
      {LABELS.track[t]}
    </Link>
  );

  return (
    <>
      <PageHero
        title="Programlar ve uygunluk"
        crumbs={['Öğrenci', data.term ? termLabel(data.term) : '']}
        subtitle="Açık programları ve her birine uygun olup olmadığınızı, ilgili yönerge maddesiyle birlikte görebilirsiniz."
      />
      <Page>
        {s && (
          <Card className="grid gap-4 p-5 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <p className="text-xs uppercase tracking-wide text-su-subtle">OBİS'ten okunan bilgiler</p>
              <p className="font-semibold text-su-heading">
                {s.fullName} · {s.studentNo}
              </p>
              <p className="text-sm text-su-muted">
                {s.programName} — {s.unitName}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-su-subtle">GNO / Yarıyıl</p>
              <p className="text-lg font-semibold text-su-primary">
                {fmtGpa(s.gano)} · {s.semesterNo}. yarıyıl
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-su-subtle">Sınıf başarı sırası</p>
              <p className="text-lg font-semibold text-su-primary">{s.classRankPercentile != null ? `ilk %${s.classRankPercentile}` : '—'}</p>
            </div>
          </Card>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2" role="tablist" aria-label="Program türü">
            {tab('CAP')}
            {tab('YANDAL')}
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Badge tone="ok">{eligibleCount} uygun program</Badge>
            <Link href={`?tur=${type}${filter === 'uygun' ? '' : '&filtre=uygun'}`} className="text-sm">
              {filter === 'uygun' ? 'Tümünü göster' : 'Yalnızca uygun olanlar'}
            </Link>
          </div>
        </div>
        <Alert tone="info">
          Belge yüklemeniz gerekmez: GNO, yarıyıl ve sınıf sıralaması OBİS'ten okunur. Uygun olmadığınız programlarda hangi koşulun sağlanmadığı ve yönergedeki
          dayanağı gösterilir.
        </Alert>
        {items.length === 0 ? (
          <Empty>Bu dönemde gösterilecek program yok.</Empty>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {items.map((item) => (
              <OfferingCard key={item.offering.id} item={item} />
            ))}
          </div>
        )}
      </Page>
    </>
  );
}
