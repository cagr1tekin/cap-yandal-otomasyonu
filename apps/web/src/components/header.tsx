import Link from 'next/link';
import { Bell, LogOut } from 'lucide-react';
import { LABELS, type Role } from '@cap/contracts';
import type { SessionUser } from '@/lib/auth';
import { buttonVariants } from '@/components/ui';
import { NavLinks } from './nav-links';

export interface NavItem {
  href: string;
  label: string;
}

export function navFor(roles: Role[]): NavItem[] {
  const items: NavItem[] = [];
  const add = (href: string, label: string) => {
    if (!items.some((i) => i.href === href)) items.push({ href, label });
  };
  if (roles.includes('OGRENCI')) {
    add('/ogrenci/programlar', 'Programlar');
    add('/ogrenci/basvurularim', 'Başvurularım');
    add('/ogrenci/programlarim', 'Programlarım');
  }
  if (roles.includes('KOORDINATOR')) add('/koordinator', 'Koordinatörlük');
  if (roles.includes('DANISMAN')) add('/danisman', 'Danışmanlık');
  if (roles.some((r) => r === 'BOLUM_BASKANI' || r === 'BIRIM' || r === 'OIDB')) add('/birim/teklifler', 'Teklifler');
  if (roles.some((r) => r === 'BIRIM' || r === 'OIDB')) {
    add('/birim/takvim', 'Takvim');
    add('/birim/kararlar', 'Kararlar');
    add('/birim/taramalar', 'Taramalar');
  }
  if (roles.includes('OIDB')) add('/oidb/kurallar', 'Kurallar');
  if (roles.some((r) => r === 'BIRIM' || r === 'OIDB' || r === 'BOLUM_BASKANI' || r === 'KOORDINATOR')) add('/raporlar', 'Raporlar');
  return items;
}

/** Wordmark: resmî logo kullanılmaz (bkz. docs/GELISTIRME-PLANI.md bölüm 1). */
function Brand() {
  return (
    <Link href="/" className="flex items-center gap-3 text-white no-underline" aria-label="Ana sayfa">
      <span aria-hidden className="grid size-10 place-items-center rounded-full border-2 border-su-accent text-[13px] font-bold text-su-accent">
        SÜ
      </span>
      <span className="leading-tight">
        <span className="block text-[13px] font-semibold uppercase tracking-[0.12em]">Selçuk Üniversitesi</span>
        <span className="block text-[11px] uppercase tracking-[0.18em] text-white/70">Çift Ana Dal · Yan Dal</span>
      </span>
    </Link>
  );
}

export function Header({ user, unread }: { user: SessionUser | null; unread: number }) {
  const items = user ? navFor(user.roles) : [];
  return (
    <header className="sticky top-0 z-40 bg-su-primary shadow-[0_2px_10px_rgba(13,45,94,0.25)]">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Brand />
        <div className="hidden min-w-0 flex-1 justify-end lg:flex">
          <NavLinks items={items} />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {user ? (
            <>
              <Link href="/bildirimler" className={buttonVariants({ variant: 'accent', size: 'sm' })} aria-label={`Bildirimler, ${unread} okunmamış`}>
                <Bell aria-hidden className="size-4" />
                <span className="hidden sm:inline">BİLDİRİMLER</span>
                {unread > 0 && <span className="rounded-pill bg-su-primary-dark px-1.5 text-[11px] text-white">{unread}</span>}
              </Link>
              <div className="hidden text-right text-white md:block">
                <p className="max-w-40 truncate text-[13px] font-medium">{user.name}</p>
                <p className="text-[11px] text-white/65">{user.roles.map((r) => LABELS.role[r]).join(', ')}</p>
              </div>
              <a
                href="/api/cikis"
                className="grid size-8 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
                aria-label="Çıkış yap"
                title="Çıkış yap"
              >
                <LogOut aria-hidden className="size-4" />
              </a>
            </>
          ) : (
            <Link href="/giris" className={buttonVariants({ variant: 'accent', size: 'sm' })}>
              GİRİŞ YAP
            </Link>
          )}
        </div>
      </div>
      {items.length > 0 && (
        <div className="border-t border-white/10 lg:hidden">
          <div className="mx-auto max-w-6xl overflow-x-auto px-2 py-1.5">
            <NavLinks items={items} />
          </div>
        </div>
      )}
      <div aria-hidden className="h-1 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.18)_50%,transparent_100%)]" />
    </header>
  );
}

export function Footer() {
  return (
    <footer className="mt-12 bg-su-primary-dark text-white/75">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 text-sm sm:grid-cols-3 sm:px-6">
        <div>
          <p className="font-semibold uppercase tracking-wider text-white">Selçuk Üniversitesi</p>
          <p className="mt-1">Çift Ana Dal ve Yan Dal Başvuru ve Takip Sistemi</p>
        </div>
        <div>
          <p className="font-medium text-white">Dayanak</p>
          <p className="mt-1">ÇAP Yönergesi (Senato 2026-20) · Yan Dal Yönergesi (2023-131)</p>
        </div>
        <div className="sm:text-right">
          <p className="inline-block rounded-pill bg-su-accent px-3 py-1 text-xs font-semibold text-su-primary-dark">
            Bitirme projesi — resmî sistem değildir
          </p>
        </div>
      </div>
    </footer>
  );
}
