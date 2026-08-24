'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { BOTTOM_NAV_ITEMS, isActiveNav, isMoreActive } from '@/config/navigation';
import { cn } from '@/lib/utils';

/**
 * Phone navigation.
 *
 * Six destinations, each drawn as a small geometric mark rather than a
 * pictogram — the shape is the identity, and the label under it never hides, so
 * nothing depends on decoding the shape. Fixed to the bottom, inside the safe
 * area, with 56px targets: the whole app is meant to be usable one-handed while
 * doing something else.
 */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-border-soft bg-card/90 backdrop-blur-xl lg:hidden"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around px-2">
        {BOTTOM_NAV_ITEMS.map((item) => {
          const active =
            item.href === '/more' ? isMoreActive(pathname) : isActiveNav(pathname, item.href);

          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-14 flex-col items-center justify-center gap-1.5 rounded-2xl px-0.5 py-2 text-[9.5px] transition-colors',
                  active ? 'font-semibold text-foreground' : 'font-medium text-subtle',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'size-[19px] border-2 transition-all duration-300',
                    active ? 'border-primary-fill bg-primary-fill' : 'border-subtle bg-transparent',
                  )}
                  style={{ borderRadius: item.markRadius }}
                />
                <span>{item.shortLabel ?? item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
