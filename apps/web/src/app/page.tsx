import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, FileStack, ListChecks, MessagesSquare, ShieldCheck } from 'lucide-react';
import { buttonVariants, Card, Page } from '@/components/ui';
import { getMe } from '@/lib/me';

export default async function Home() {
  if (await getMe()) redirect('/panel');
  const parts = [
    { Icon: ListChecks, title: 'Ders takibi', text: 'Alınacak dersler, hangi dönem alındığı ve geçildiği, notlar, tekrarlar; tamamlanan ve kalan AKTS tek bakışta.' },
    { Icon: FileStack, title: 'Belge arşivi', text: 'İmzalı formlar, dönem not belgeleri ve resmî yazılar sürümleriyle; ek belge istekleri izlenir.' },
    { Icon: MessagesSquare, title: 'Yazışma', text: 'Koordinatör ile öğrenci arasında kalıcı, ekli mesajlaşma.' },
    { Icon: ShieldCheck, title: 'Yönerge kuralları', text: 'GNO eşikleri, ders almama ve süre kuralları onaylı kayıtlarla denetlenir; uyarı verir, kararı koordinatör verir.' },
  ];
  return (
    <>
      <section className="relative overflow-hidden bg-su-primary text-white">
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_80%_10%,rgba(255,201,13,0.18),transparent_40%),radial-gradient(circle_at_10%_90%,rgba(255,255,255,0.08),transparent_45%)]" />
        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <p className="mb-3 inline-block rounded-pill bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-white/80">Teknoloji Fakültesi · Bilgisayar Mühendisliği Bölümü</p>
          <h1 className="max-w-3xl text-3xl font-medium text-white sm:text-5xl sm:leading-tight">Çift ana dal ve yan dal öğrencilerinin takibi tek yerde.</h1>
          <p className="mt-4 max-w-2xl text-white/80">Bölüme gelen ÇAP ve YDP öğrencileri için ders, not, belge ve yazışma takibi. Hesapları koordinatör açar.</p>
          <div className="mt-8">
            <Link href="/giris" className={buttonVariants({ variant: 'accent', size: 'lg' })}>
              GİRİŞ YAP <ArrowRight aria-hidden className="size-4" />
            </Link>
          </div>
        </div>
      </section>
      <Page>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {parts.map((p) => (
            <Card key={p.title} className="p-5">
              <p.Icon aria-hidden className="mb-3 size-7 text-su-primary" />
              <h2 className="text-base">{p.title}</h2>
              <p className="mt-1 text-sm text-su-muted">{p.text}</p>
            </Card>
          ))}
        </div>
        <p className="text-xs text-su-muted">
          Başvuru değerlendirmesi ve öğrenci seçimi bu sistemde yapılmaz; dekanlık yapar. Sistemin OBİS bağlantısı yoktur; bilgiler elle girilir ve koordinatör onayıyla kesinleşir.
        </p>
      </Page>
    </>
  );
}
