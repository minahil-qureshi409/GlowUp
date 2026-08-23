'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { BOTTOM_NAV_ITEMS, isActiveNav } from '@/config/navigation';
import { cn } from '@/lib/utils';

/**
 * Phone navigation.
 *
 * Fixed to the bottom, inside the safe area, with 56px targets — the whole app
 * is meant to be usable one-handed while doing something else.
 */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/85 backdrop-blur-lg lg:hidden"
    >
      <ul className="pb-safe mx-auto flex max-w-lg items-stretch justify-around px-1">
        {BOTTOM_NAV_ITEMS.map((item) => {
          const active = isActiveNav(pathname, item.href);
          const Icon = item.icon;

          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[11px] font-medium transition-colors',
                  active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <span
                  className={cn(
                    'flex size-8 items-center justify-center rounded-full transition-colors',
                    active && 'bg-primary-soft',
                  )}
                >
                  <Icon className="size-[18px]" aria-hidden="true" strokeWidth={active ? 2.4 : 2} />
                </span>
                <span>{item.shortLabel ?? item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
