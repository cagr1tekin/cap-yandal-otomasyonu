'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import { cn } from '@/lib/format';
import type { NavGroup } from './header';

function isActive(path: string, href: string) {
  return path === href || (href !== '/panel' && path.startsWith(`${href}/`));
}

function Groups({ groups, path }: { groups: NavGroup[]; path: string }) {
  return (
    <>
      {groups.map((g) => (
        <div key={g.title} className="mb-5">
          <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-su-subtle">{g.title}</p>
          <ul className="space-y-0.5">
            {g.items.map((item) => {
              const active = isActive(path, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'block rounded-pill px-3 py-2 text-[13px] font-medium no-underline transition-colors',
                      active ? 'bg-su-primary text-white shadow-[inset_3px_0_0_var(--color-su-accent)]' : 'text-su-heading hover:bg-su-primary-soft',
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </>
  );
}

/** Panel sol menüsü; küçük ekranda açılır menü. */
export function Sidebar({ groups }: { groups: NavGroup[] }) {
  const path = usePathname();
  return (
    <>
      <nav aria-label="Panel menüsü" className="hidden w-60 shrink-0 lg:block">
        <div className="sticky top-24 rounded-2xl border border-su-border/70 bg-white p-3">
          <Groups groups={groups} path={path} />
        </div>
      </nav>
      <details className="rounded-2xl border border-su-border/70 bg-white lg:hidden">
        <summary className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-su-primary">
          <Menu aria-hidden className="size-4" /> Menü
        </summary>
        <nav aria-label="Panel menüsü (mobil)" className="px-2 pb-2">
          <Groups groups={groups} path={path} />
        </nav>
      </details>
    </>
  );
}
