import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, ClipboardCheck, FileCheck2, ListOrdered, ShieldCheck } from 'lucide-react';
import { navFor } from '@/components/header';
import { buttonVariants, Card, Page } from '@/components/ui';
import { currentUser } from '@/lib/auth';

export default async function Home() {
  const user = await currentUser();
  if (user) {
    const first = navFor(user.roles)[0];
    if (first) redirect(first.href);
  }

  const steps = [
    { Icon: ClipboardCheck, title: 'Uygunluğunu gör', text: 'Açık programlar ve her birine uygun olup olmadığın, yönerge maddesiyle birlikte.' },
    { Icon: FileCheck2, title: 'Belgesiz başvur', text: 'Öğrenci belgesi ve transkript istenmez; bilgiler OBİS\'ten okunur.' },
    { Icon: ListOrdered, title: 'Sonucu izle', text: 'Bölüm incelemesi, kurul kararı ve ilan aşamaları tek ekranda.' },
    { Icon: ShieldCheck, title: 'Kaydını koru', text: 'Dönem sonunda kaydını etkileyen durumlar için önceden uyarı al.' },
  ];

  return (
    <>
      <section className="relative overflow-hidden bg-su-primary text-white">
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_80%_10%,rgba(255,201,13,0.18),transparent_40%),radial-gradient(circle_at_10%_90%,rgba(255,255,255,0.08),transparent_45%)]" />
        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <p className="mb-3 inline-block rounded-pill bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-white/80">2026-2027 Güz</p>
          <h1 className="max-w-3xl text-3xl font-medium text-white sm:text-5xl sm:leading-tight">
            Çift ana dal ve yan dal başvurusu, artık kâğıtsız.
          </h1>
          <p className="mt-4 max-w-2xl text-white/80">
            Başvuru koşullarını önceden gör, birime gitmeden başvur, sonucu ve kaydını tek yerden takip et.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/giris" className={buttonVariants({ variant: 'accent', size: 'lg' })}>
              ÜNİVERSİTE HESABIYLA GİRİŞ <ArrowRight aria-hidden className="size-4" />
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
          <h2 className="text-lg">Bu sistemde yapılmayanlar</h2>
          <p className="mt-2 text-sm text-su-muted">
            Ders kaydı, not, katkı payı ve kesin kayıt OBİS'te; resmî belgeler e-Devlet'te; yönetim kurulu kararlarının aslı EBYS'de kalır.
            Bu sistem yalnızca çift ana dal ve yan dala özgü başvuru ve takip işini yapar, gerektiğinde sizi ilgili sisteme yönlendirir.
          </p>
        </Card>
      </Page>
    </>
  );
}
