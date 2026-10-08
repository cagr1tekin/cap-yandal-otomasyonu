import Link from 'next/link';
import { Bell, LogOut } from 'lucide-react';
import { LABELS, type Role } from '@cap/contracts';
import type { SessionUser } from '@/lib/auth';
import type { Me } from '@/lib/types';
import { buttonVariants } from '@/components/ui';

export interface NavItem {
  href: string;
  label: string;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

/**
 * Rol bazlı menü (KARARLAR K-12). Her öğe yalnızca o işi yapan role görünür.
 * Öğrenci, komisyon (koordinatör), Bilgisayar Müh. bölüm başkanı ve ana dal imzacıları ayrı menü görür.
 */
export function navFor(me: Pick<Me, 'roles' | 'homeHead' | 'mainDepartmentSigner'>): NavGroup[] {
  const has = (...r: Role[]) => r.some((x) => me.roles.includes(x));
  const groups: NavGroup[] = [];
  groups.push({
    title: 'Genel',
    items: [
      { href: '/panel', label: 'Görevlerim' },
      { href: '/onaylar', label: 'İmzalarım' },
      { href: '/bildirimler', label: 'Bildirimler' },
      { href: '/belgeler', label: 'Yönerge ve formlar' },
    ],
  });

  if (has('OGRENCI')) {
    groups.push({
      title: 'Öğrenci',
      items: [
        { href: '/ogrenci/bilgilerim', label: 'Bilgilerim ve belgelerim' },
        { href: '/ogrenci/basvuru', label: 'Başvuru' },
        { href: '/ogrenci/kayitlarim', label: 'ÇAP / yan dal kayıtlarım' },
      ],
    });
  }

  const dept = has('KOORDINATOR') || me.homeHead;
  if (dept) {
    groups.push({
      title: 'Başvuru süreci',
      items: [
        { href: '/koordinator/donem', label: 'Kontenjan ve takvim' },
        { href: '/koordinator/basvurular', label: 'Başvurular' },
        { href: '/koordinator/degerlendirme', label: 'Sıralama ve karar' },
      ],
    });
    groups.push({
      title: 'Kayıtlı öğrenciler',
      items: [
        { href: '/koordinator/ogrenciler', label: 'Öğrenciler' },
        { href: '/koordinator/protokoller', label: 'Protokol şablonları' },
        { href: '/koordinator/taramalar', label: 'Dönem sonu taramaları' },
      ],
    });
  }
  if (me.mainDepartmentSigner) groups.push({ title: 'Ana dal bölümü', items: [{ href: '/ana-dal', label: 'Bölümümün öğrencileri' }] });

  if (dept) {
    groups.push({
      title: 'Yönetim',
      items: [
        { href: '/raporlar', label: 'Raporlar' },
        { href: '/koordinator/kurallar', label: 'Kural setleri' },
        { href: '/yonetim/kullanicilar', label: 'Kullanıcılar ve roller' },
        { href: '/yonetim/denetim', label: 'Denetim kaydı' },
      ],
    });
  }
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
        <span className="block text-[11px] uppercase tracking-[0.18em] text-white/70">Bilgisayar Müh. · ÇAP ve Yan Dal</span>
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
                <p className="max-w-56 truncate text-[11px] text-white/65">{user.roles.map((r) => LABELS.role[r]).join(', ')}</p>
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
          <p className="mt-1">Teknoloji Fakültesi Bilgisayar Mühendisliği Bölümü · Çift Ana Dal ve Yan Dal Otomasyonu</p>
        </div>
        <div>
          <p className="font-medium text-white">Dayanak</p>
          <p className="mt-1">YÖK Geçiş Yönetmeliği m.16–20 · ÇAP Yönergesi (2026-20) · Yan Dal Yönergesi (2023-131) · Bölüm ÇAP Rehberi (2025)</p>
        </div>
        <div className="sm:text-right">
          <p className="inline-block rounded-pill bg-su-accent px-3 py-1 text-xs font-semibold text-su-primary-dark">Bitirme projesi — resmî sistem değildir</p>
        </div>
      </div>
    </footer>
  );
}
