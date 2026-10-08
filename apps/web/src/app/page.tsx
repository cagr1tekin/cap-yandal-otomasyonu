import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, ClipboardList, FileSignature, ListChecks, ShieldCheck } from 'lucide-react';
import { buttonVariants, Card, Page } from '@/components/ui';
import { getMe } from '@/lib/me';

export default async function Home() {
  if (await getMe()) redirect('/panel');

  const steps = [
    { Icon: ClipboardList, title: 'Başvuru girişi', text: 'Şahsen gelen dilekçe öğrenci numarasıyla girilir; uygunluk ve zorunlu belgeler OBİS verisiyle anında denetlenir.' },
    { Icon: ListChecks, title: 'Değerlendirme ve karar', text: 'GNO sıralaması, gerekçeli değişiklik, yönetim kurulu kararı ve maskeli sonuç listesi.' },
    { Icon: FileSignature, title: 'Protokol ve ders kaydı', text: 'Beş imzalı Kabul ve Ders Protokolü ve her dönemin ders kayıt formu, kâğıt dolaştırmadan.' },
    { Icon: ShieldCheck, title: 'Takip', text: 'Dönem sonu taraması, izinler, kayıt silme kararları ve değiştirilemez denetim kaydı.' },
  ];

  return (
    <>
      <section className="relative overflow-hidden bg-su-primary text-white">
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_80%_10%,rgba(255,201,13,0.18),transparent_40%),radial-gradient(circle_at_10%_90%,rgba(255,255,255,0.08),transparent_45%)]" />
        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <p className="mb-3 inline-block rounded-pill bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-white/80">Personel paneli</p>
          <h1 className="max-w-3xl text-3xl font-medium text-white sm:text-5xl sm:leading-tight">Çift ana dal ve yan dal süreçleri tek panelde.</h1>
          <p className="mt-4 max-w-2xl text-white/80">
            Öğrenci işleri, koordinatörler, bölüm başkanları, danışmanlar ve Öğrenci İşleri Daire Başkanlığı için rol bazlı yönetim paneli.
          </p>
          <div className="mt-8">
            <Link href="/giris" className={buttonVariants({ variant: 'accent', size: 'lg' })}>
              PERSONEL GİRİŞİ <ArrowRight aria-hidden className="size-4" />
            </Link>
          </div>
        </div>
      </section>
      <Page>
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
          <h2 className="text-lg">Bu panelde yapılmayanlar</h2>
          <p className="mt-2 text-sm text-su-muted">
            Not, ders kaydının OBİS'e işlenmesi ve öğrenci belgeleri OBİS ve e-Devlet'te; yönetim kurulu kararlarının aslı EBYS'de kalır. Panel bu sistemlere
            girilecek listeleri üretir. Öğrenciler bu panele girmez; başvurusunu birime dilekçeyle yapar ve bilgilendirmeleri e-postayla alır.
          </p>
        </Card>
      </Page>
    </>
  );
}
