import Link from 'next/link';
import { Bell, LogOut } from 'lucide-react';
import { LABELS, type Role } from '@cap/contracts';
import type { SessionUser } from '@/lib/auth';
import { buttonVariants } from '@/components/ui';

export interface NavItem {
  href: string;
  label: string;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

/** Rol bazlı menü (KARARLAR K-1). Her öğe yalnızca o işi yapan rollere görünür. */
export function navFor(roles: Role[]): NavGroup[] {
  const has = (...r: Role[]) => r.some((x) => roles.includes(x));
  const groups: NavGroup[] = [];
  const general: NavItem[] = [{ href: '/panel', label: 'Görevlerim' }];
  if (has('KOORDINATOR', 'DANISMAN', 'BOLUM_BASKANI')) general.push({ href: '/onaylar', label: 'Onaylarım' });
  general.push({ href: '/bildirimler', label: 'Bildirimler' });
  groups.push({ title: 'Genel', items: general });

  const process: NavItem[] = [];
  if (has('BIRIM', 'OIDB')) {
    process.push({ href: '/birim/basvurular', label: 'Başvurular' });
    process.push({ href: '/birim/kararlar', label: 'Kararlar ve kesin kayıt' });
  }
  if (has('KOORDINATOR')) process.push({ href: '/koordinator', label: 'Koordinatörlük' });
  if (process.length) groups.push({ title: 'Başvuru süreci', items: process });

  const enrolled: NavItem[] = [];
  if (has('BIRIM', 'OIDB')) {
    enrolled.push({ href: '/birim/protokoller', label: 'Protokoller' });
    enrolled.push({ href: '/birim/ders-kayitlari', label: 'Ders kayıt formları' });
    enrolled.push({ href: '/birim/taramalar', label: 'Dönem sonu taramaları' });
  }
  if (has('KOORDINATOR')) enrolled.push({ href: '/koordinator/teslim', label: 'Toplu teslim' });
  if (has('DANISMAN', 'KOORDINATOR')) enrolled.push({ href: '/danisman', label: 'Öğrencilerim' });
  if (enrolled.length) groups.push({ title: 'Kayıtlı öğrenciler', items: enrolled });

  const admin: NavItem[] = [];
  if (has('BOLUM_BASKANI', 'BIRIM', 'OIDB')) admin.push({ href: '/birim/teklifler', label: 'Teklifler ve kontenjan' });
  if (has('BIRIM', 'OIDB')) admin.push({ href: '/birim/takvim', label: 'Takvim' });
  if (has('BIRIM', 'OIDB', 'BOLUM_BASKANI', 'KOORDINATOR')) admin.push({ href: '/raporlar', label: 'Raporlar' });
  if (has('OIDB')) {
    admin.push({ href: '/oidb/kurallar', label: 'Kural setleri' });
    admin.push({ href: '/oidb/kullanicilar', label: 'Kullanıcılar ve roller' });
    admin.push({ href: '/oidb/denetim', label: 'Denetim kaydı' });
  }
  if (admin.length) groups.push({ title: 'Yönetim', items: admin });
  return groups;
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
        <span className="block text-[11px] uppercase tracking-[0.18em] text-white/70">ÇAP · Yan Dal Yönetim Paneli</span>
      </span>
    </Link>
  );
}

export function Header({ user, unread }: { user: SessionUser | null; unread: number }) {
  return (
    <header className="sticky top-0 z-40 bg-su-primary shadow-[0_2px_10px_rgba(13,45,94,0.25)]">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Brand />
        <div className="flex shrink-0 items-center gap-2">
          {user ? (
            <>
              <Link href="/bildirimler" className={buttonVariants({ variant: 'accent', size: 'sm' })} aria-label={`Bildirimler, ${unread} okunmamış`}>
                <Bell aria-hidden className="size-4" />
                <span className="hidden sm:inline">BİLDİRİMLER</span>
                {unread > 0 && <span className="rounded-pill bg-su-primary-dark px-1.5 text-[11px] text-white">{unread}</span>}
              </Link>
              <div className="hidden text-right text-white md:block">
                <p className="max-w-56 truncate text-[13px] font-medium">{user.name}</p>
                <p className="max-w-56 truncate text-[11px] text-white/65">{user.roles.map((r) => LABELS.role[r]).join(', ') || 'Rol atanmamış'}</p>
              </div>
              <a href="/api/cikis" className="grid size-8 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20" aria-label="Çıkış yap" title="Çıkış yap">
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
      <div aria-hidden className="h-1 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.18)_50%,transparent_100%)]" />
    </header>
  );
}

export function Footer() {
  return (
    <footer className="bg-su-primary-dark text-white/75">
      <div className="mx-auto grid max-w-[1400px] gap-6 px-4 py-6 text-sm sm:grid-cols-3 sm:px-6">
        <div>
          <p className="font-semibold uppercase tracking-wider text-white">Selçuk Üniversitesi</p>
          <p className="mt-1">Çift Ana Dal ve Yan Dal Yönetim Paneli</p>
        </div>
        <div>
          <p className="font-medium text-white">Dayanak</p>
          <p className="mt-1">YÖK Geçiş Yönetmeliği m.16–20 · ÇAP Yönergesi (2026-20) · Yan Dal Yönergesi (2023-131)</p>
        </div>
        <div className="sm:text-right">
          <p className="inline-block rounded-pill bg-su-accent px-3 py-1 text-xs font-semibold text-su-primary-dark">Bitirme projesi — resmî sistem değildir</p>
        </div>
      </div>
    </footer>
  );
}
