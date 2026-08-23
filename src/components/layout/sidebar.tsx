'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { NAV_ITEMS, isActiveNav } from '@/config/navigation';
import { cn } from '@/lib/utils';

type SidebarProps = {
  displayName: string | null;
  goalSummary: string | null;
};

/** Desktop navigation. Shows every destination, including the two the bottom bar omits. */
export function Sidebar({ displayName, goalSummary }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-6 border-r border-border/70 bg-card/40 px-4 py-6 lg:flex">
      <div className="px-2">
        <Link href="/today" className="flex items-baseline gap-1.5">
          <span className="font-display text-xl font-semibold tracking-tight">GlowUp</span>
          <span aria-hidden="true" className="text-sm">
            ✨
          </span>
        </Link>
        {displayName ? (
          <p className="mt-1 truncate text-sm text-muted-foreground">{displayName}</p>
        ) : null}
      </div>

      <nav aria-label="Main" className="flex-1">
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const active = isActiveNav(pathname, item.href);
            const Icon = item.icon;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                    active
                      ? 'bg-primary-soft text-primary'
                      : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                  )}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {goalSummary ? (
        <div className="rounded-xl bg-gradient-veil px-3 py-3 text-xs text-muted-foreground">
          {goalSummary}
        </div>
      ) : null}
    </aside>
  );
}
