import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, ClipboardCheck, FileSignature, ListChecks, ShieldCheck } from 'lucide-react';
import { LABELS, type TrackType } from '@cap/contracts';
import { Badge, buttonVariants, Card, CardTitle, Page } from '@/components/ui';
import { fmtDate, termLabel } from '@/lib/format';
import { getMe } from '@/lib/me';
import type { ExternalLink, Term, WindowState } from '@/lib/types';

interface PublicOfferings {
  term: Term | null;
  offerings: { id: string; type: TrackType; quota: number; sourcePrograms: string[]; window: WindowState; registrationDeadline: string | null }[];
}

async function load<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${process.env.API_URL}${path}`, { cache: 'no-store' });
    return res.ok ? ((await res.json()) as T) : fallback;
  } catch {
    return fallback;
  }
}

const phase = { TASLAK: 'Taslak', ONCE: 'Başvuru başlamadı', ACIK: 'Başvuru açık', KAPANDI: 'Başvuru kapandı' } as const;

export default async function Home() {
  if (await getMe()) redirect('/panel');
  const [data, links] = await Promise.all([load<PublicOfferings>('/offerings/public', { term: null, offerings: [] }), load<ExternalLink[]>('/links', [])]);

  const steps = [
    { Icon: ClipboardCheck, title: 'Bilgini gir, uygunluğunu gör', text: 'Öğrenci GNO, yarıyıl ve sıralama bilgisini kendisi girer; yönerge kuralları anında çalışır ve hangi koşulun neden sağlanmadığını gösterir.' },
    { Icon: ListChecks, title: 'Çevrim içi başvuru ve sıralama', text: 'Belgeler yüklenir, komisyon beyanı belgeyle doğrular, GNO sıralaması ve kurul kararı sistemde işlenir.' },
    { Icon: FileSignature, title: 'Protokol ve formlar', text: 'Bölümün gerçek ÇAP protokolleri şablondur. Protokol beş, ders kayıt ve muafiyet formları üç imzayla kâğıt dolaşmadan tamamlanır.' },
    { Icon: ShieldCheck, title: 'Dönem takibi', text: 'Not girişi, dönem sonu taraması, GNO uyarıları, izinler ve değiştirilemez denetim kaydı.' },
  ];

  return (
    <>
      <section className="relative overflow-hidden bg-su-primary text-white">
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_80%_10%,rgba(255,201,13,0.18),transparent_40%),radial-gradient(circle_at_10%_90%,rgba(255,255,255,0.08),transparent_45%)]" />
        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <p className="mb-3 inline-block rounded-pill bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-white/80">Teknoloji Fakültesi · Bilgisayar Mühendisliği Bölümü</p>
          <h1 className="max-w-3xl text-3xl font-medium text-white sm:text-5xl sm:leading-tight">Çift ana dal ve yan dal başvurusu, protokolü ve takibi tek yerde.</h1>
          <p className="mt-4 max-w-2xl text-white/80">
            Bilgisayar Mühendisliğinde çift ana dal ya da yan dal yapmak isteyen öğrenciler ile bölümün ÇAP komisyonu, danışmanlar ve bölüm başkanları için.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/giris?donus=/ogrenci/basvuru" className={buttonVariants({ variant: 'accent', size: 'lg' })}>
              ÖĞRENCİ GİRİŞİ <ArrowRight aria-hidden className="size-4" />
            </Link>
            <Link href="/giris?donus=/panel" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
              PERSONEL GİRİŞİ
            </Link>
          </div>
        </div>
      </section>
      <Page>
        {data.offerings.length > 0 && (
          <Card>
            <CardTitle>{data.term ? `${termLabel(data.term)} başvuruları` : 'Başvurular'}</CardTitle>
            <div className="grid gap-3 sm:grid-cols-2">
              {data.offerings.map((o) => (
                <div key={o.id} className="rounded-xl border border-su-border/70 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-base font-semibold">Bilgisayar Mühendisliği {LABELS.track[o.type]}</h3>
                    <Badge tone={o.window.open ? 'ok' : 'muted'}>{phase[o.window.phase]}</Badge>
                  </div>
                  <dl className="mt-2 space-y-1 text-sm text-su-muted">
                    <div>
                      <dt className="inline font-medium text-su-heading">Kontenjan: </dt>
                      <dd className="inline">{o.quota}</dd>
                    </div>
                    <div>
                      <dt className="inline font-medium text-su-heading">Başvurabilen bölümler: </dt>
                      <dd className="inline">{o.sourcePrograms.length ? o.sourcePrograms.join(', ') : 'Tüm bölümler'}</dd>
                    </div>
                    <div>
                      <dt className="inline font-medium text-su-heading">Başvuru: </dt>
                      <dd className="inline">
                        {fmtDate(o.window.opensAt)} – {fmtDate(o.window.closesAt)}
                      </dd>
                    </div>
                  </dl>
                </div>
              ))}
            </div>
          </Card>
        )}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s) => (
            <Card key={s.title} className="p-5">
              <s.Icon aria-hidden className="mb-3 size-7 text-su-primary" />
              <h2 className="text-base">{s.title}</h2>
              <p className="mt-1 text-sm text-su-muted">{s.text}</p>
            </Card>
          ))}
        </div>
        <Card>
          <CardTitle>Yönerge, rehber ve protokoller</CardTitle>
          <ul className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {links
              .filter((l) => l.system === 'Belge' || l.key === 'bolum-cap')
              .map((l) => (
                <li key={l.key}>
                  <a href={l.url} target="_blank" rel="noreferrer">
                    {l.label}
                  </a>
                  <span className="block text-xs text-su-muted">{l.description}</span>
                </li>
              ))}
          </ul>
          <p className="mt-4 text-xs text-su-muted">
            Derslerin resmî kaydı ve notlar OBİS’te tutulur. Bu sistemin OBİS bağlantısı yoktur: öğrenci bilgilerini kendisi girer, komisyon yüklenen belgelerle doğrular.
          </p>
        </Card>
      </Page>
    </>
  );
}
