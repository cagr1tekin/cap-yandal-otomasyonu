import { redirect } from 'next/navigation';
import { navFor } from '@/components/header';
import { Sidebar } from '@/components/nav-links';
import { Alert } from '@/components/ui';
import { getMe } from '@/lib/me';

/** Rol bazlı yönetim paneli düzeni: sol menü + içerik. */
export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await getMe();
  if (!user) redirect('/giris');
  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-4 px-0 py-0 lg:flex-row lg:gap-6 lg:px-6 lg:py-6">
      <div className="px-4 pt-4 lg:px-0 lg:pt-0">
        <Sidebar groups={navFor(user.roles)} />
      </div>
      <div className="min-w-0 flex-1 lg:overflow-hidden lg:rounded-2xl lg:border lg:border-su-border/70 lg:bg-su-bg">
        {user.roles.length === 0 ? (
          <div className="p-6">
            <Alert tone="warn" title="Hesabınıza rol atanmamış.">
              Panelde işlem yapabilmek için Öğrenci İşleri Daire Başkanlığının size rol ve kapsam (birim / program) ataması gerekir.
            </Alert>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
