import { redirect } from 'next/navigation';
import { navFor } from '@/components/header';
import { Sidebar } from '@/components/nav-links';
import { Alert, Page } from '@/components/ui';
import { getSession } from '@/lib/me';

/** Rol bazlı panel düzeni: sol menü + içerik. */
export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const { me, unknown } = await getSession();
  if (unknown) {
    return (
      <Page className="max-w-2xl">
        <Alert tone="warn" title="Hesabınız bu sistemde tanımlı değil ya da pasif.">
          Hesapları ÇAP / YDP koordinatörü açar. <a href="/api/cikis">Çıkış yap</a>
        </Alert>
      </Page>
    );
  }
  if (!me) redirect('/giris');
  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-4 px-0 py-0 lg:flex-row lg:gap-6 lg:px-6 lg:py-6">
      <div className="px-4 pt-4 lg:px-0 lg:pt-0">
        <Sidebar groups={navFor(me)} />
      </div>
      <div className="min-w-0 flex-1 lg:overflow-hidden lg:rounded-2xl lg:border lg:border-su-border/70 lg:bg-su-bg">{children}</div>
    </div>
  );
}
