'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { SIDEBAR_ITEMS, isActiveNav } from '@/config/navigation';
import { cn } from '@/lib/utils';

type SidebarProps = {
  displayName: string | null;
  goalSummary: string | null;
  streakDays: number;
};

/**
 * Desktop navigation. Every destination in one flat list — on a wide screen
 * there is no reason to hide half the app behind a More.
 */
export function Sidebar({ displayName, goalSummary, streakDays }: SidebarProps) {
  const pathname = usePathname();
  const toMilestone = nextStreakMilestone(streakDays);

  return (
    <aside className="sticky top-0 hidden h-dvh w-[250px] shrink-0 flex-col gap-6 border-r border-border-soft bg-card/60 px-5 py-7 backdrop-blur-sm lg:flex">
      <div className="px-2">
        <Link href="/today" className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex size-9 items-center justify-center rounded-xl bg-primary font-display text-lg text-primary-foreground"
          >
            G
          </span>
          <span className="font-display text-xl tracking-tight">GlowUp</span>
        </Link>
        {displayName ? (
          <p className="mt-2 truncate text-sm text-muted-foreground">{displayName}</p>
        ) : null}
      </div>

      <nav aria-label="Main" className="min-h-0 flex-1 overflow-y-auto scrollbar-none">
        <ul className="space-y-0.5">
          {SIDEBAR_ITEMS.map((item) => {
            const active = isActiveNav(pathname, item.href);

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm transition-colors',
                    active
                      ? 'bg-primary-soft font-semibold text-foreground'
                      : 'font-medium text-muted-foreground hover:bg-muted/70 hover:text-foreground',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'size-2 shrink-0 rounded-full transition-colors',
                      active ? 'bg-primary' : 'bg-border',
                    )}
                  />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="space-y-3">
        {streakDays > 0 ? (
          <div className="rounded-2xl bg-primary-soft px-4 py-4">
            <p className="text-sm font-semibold">
              <span aria-hidden="true">🔥</span> {streakDays} day streak
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {toMilestone
                ? `${toMilestone.remaining} more ${toMilestone.remaining === 1 ? 'day' : 'days'} to your ${toMilestone.target}-day milestone.`
                : 'Consistency looks good on you.'}
            </p>
          </div>
        ) : null}

        {goalSummary ? (
          <p className="px-1 text-xs leading-relaxed text-muted-foreground">{goalSummary}</p>
        ) : null}
      </div>
    </aside>
  );
}

const STREAK_MILESTONES = [7, 14, 30, 60, 100, 180, 365];

function nextStreakMilestone(days: number): { target: number; remaining: number } | null {
  const target = STREAK_MILESTONES.find((m) => m > days);
  return target ? { target, remaining: target - days } : null;
}
