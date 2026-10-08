import Link from 'next/link';
import { Bell, LogOut } from 'lucide-react';
import { LABELS, type Role } from '@cap/contracts';
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

/** Rol bazlı menü: üç giriş türü (koordinatör, öğrenci, bölüm başkanı). */
export function navFor(me: Pick<Me, 'role' | 'studentNo'>): NavGroup[] {
  if (me.role === 'OGRENCI') {
    const card = `/ogrenciler/${me.studentNo}`;
    return [
      { title: 'Genel', items: [{ href: '/panel', label: 'Yapılacaklar' }, { href: '/bildirimler', label: 'Bildirimler' }] },
      {
        title: 'Kartım',
        items: [
          { href: card, label: 'Durumum' },
          { href: `${card}?sekme=dersler`, label: 'Derslerim' },
          { href: `${card}?sekme=notlar`, label: 'Dönem sonu notları' },
          { href: `${card}?sekme=belgeler`, label: 'Belgelerim' },
          { href: `${card}?sekme=mesajlar`, label: 'Mesajlar' },
        ],
      },
      { title: 'Bilgi', items: [{ href: '/katalog', label: 'Ders kataloğu' }, { href: '/belgeler', label: 'Yönerge ve formlar' }] },
    ];
  }
  const coord = me.role === 'KOORDINATOR';
  return [
    { title: 'Genel', items: [{ href: '/panel', label: 'Pano' }, { href: '/bildirimler', label: 'Bildirimler' }] },
    {
      title: 'Öğrenci takibi',
      items: [
        { href: '/ogrenciler', label: 'Öğrenciler' },
        { href: '/onaylar', label: 'Onay bekleyenler' },
        { href: '/mesajlar', label: 'Mesajlar' },
        { href: '/kontrol', label: 'Kural kontrolü ve kararlar' },
      ],
    },
    {
      title: 'Tanımlar',
      items: [
        { href: '/katalog', label: 'Ders kataloğu' },
        { href: '/sablonlar', label: 'Ders listesi şablonları' },
        { href: '/kurallar', label: 'Yönerge kuralları' },
        ...(coord ? [{ href: '/ayarlar', label: 'Dönemler ve ayarlar' }, { href: '/iceri-aktar', label: 'İçeri aktar (CSV)' }] : []),
      ],
    },
    {
      title: 'Yönetim',
      items: [
        { href: '/kullanicilar', label: 'Hesaplar' },
        { href: '/denetim', label: 'İşlem kaydı' },
        { href: '/belgeler', label: 'Yönerge ve formlar' },
      ],
    },
  ];
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
        <span className="block text-[11px] uppercase tracking-[0.18em] text-white/70">Bilgisayar Müh. · ÇAP ve YDP Takibi</span>
      </span>
    </Link>
  );
}

export function Header({ user, unread }: { user: { username: string; name: string; role: Role } | null; unread: number }) {
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
                <p className="max-w-56 truncate text-[11px] text-white/65">{LABELS.role[user.role]}</p>
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
          <p className="mt-1">Teknoloji Fakültesi Bilgisayar Mühendisliği Bölümü · ÇAP ve YDP Öğrenci Takip Sistemi</p>
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
