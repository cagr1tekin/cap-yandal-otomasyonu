'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/format';
import type { NavItem } from './header';

/** Selçuk sitesindeki menü: büyük harf, 13px / 500, hap biçimi; öğeler arasında ince ayraç. */
export function NavLinks({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <nav aria-label="Ana menü">
      <ul className="flex items-center whitespace-nowrap">
        {items.map((item, i) => {
          const active = path === item.href || path.startsWith(`${item.href}/`);
          return (
            <li key={item.href} className="flex items-center">
              {i > 0 && <span aria-hidden className="mx-0.5 h-3 w-px bg-white/25" />}
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'rounded-pill px-[7.2px] py-[6px] text-[13px] font-medium uppercase tracking-[0.2px] text-white no-underline transition-colors hover:bg-white/10',
                  active && 'bg-white/15 shadow-[inset_0_-2px_0_var(--color-su-accent)]',
                )}
              >
                {item.label.toLocaleUpperCase('tr-TR')}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
