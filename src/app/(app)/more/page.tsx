import type { Metadata } from 'next';
import Link from 'next/link';

import { requireUser } from '@/server/auth';
import { getUserContext } from '@/services/profile';
import { getActiveHabits, getCompletionsInRange } from '@/services/habits';
import { getWeightEntries, getWeightGoal } from '@/services/weight';

import { currentStreak, dailyPercentMap } from '@/lib/domain/habits';
import { summariseWeight } from '@/lib/domain/weight';
import { subDaysKey, todayIn } from '@/lib/date';
import { formatWeight } from '@/lib/format';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'More' };
export const dynamic = 'force-dynamic';

type Tile = {
  href: string;
  label: string;
  sub: string;
  icon: string;
  tint: string;
};

export default async function MorePage() {
  const { supabase, userId } = await requireUser();
  const context = await getUserContext(supabase, userId);

  const today = todayIn(context.profile.timezone);
  const from = subDaysKey(today, 89);

  const [habits, completions, entries, goalContext] = await Promise.all([
    getActiveHabits(supabase, userId),
    getCompletionsInRange(supabase, userId, from, today),
    getWeightEntries(supabase, userId, { from: subDaysKey(today, 364) }),
    getWeightGoal(supabase, userId),
  ]);

  const summary = summariseWeight(entries, {
    goalKg: goalContext.goal?.target_value ?? null,
    startKg: goalContext.goal?.start_value ?? null,
    today,
  });
  const streak = currentStreak(dailyPercentMap(habits, completions, from, today), today);

  // Every subtitle is a real number off this user's data. A tile grid of
  // static labels is a menu; a tile grid that tells you where you stand is a
  // reason to open one.
  const tiles: Tile[] = [
    {
      href: '/progress',
      label: 'Progress',
      sub:
        summary.percentToGoal !== null
          ? `${Math.round(summary.percentToGoal)}% to your goal`
          : 'Charts, photos, milestones',
      icon: '📈',
      tint: 'bg-sage-soft',
    },
    {
      href: '/weight',
      label: 'Weight',
      sub: summary.current !== null ? `${formatWeight(summary.current)} today` : 'Nothing logged yet',
      icon: '⚖️',
      tint: 'bg-muted',
    },
    {
      href: '/calendar',
      label: 'Calendar',
      sub: 'Your month at a glance',
      icon: '📅',
      tint: 'bg-lav-soft',
    },
    {
      href: '/insights',
      label: 'Insights',
      sub: 'Patterns from your last 30 days',
      icon: '💡',
      tint: 'bg-primary-soft',
    },
    {
      href: '/streak',
      label: 'Streak',
      sub: streak > 0 ? `${streak} ${streak === 1 ? 'day' : 'days'} and counting` : 'Start one today',
      icon: '🔥',
      tint: 'bg-primary-soft',
    },
    {
      href: '/profile',
      label: 'Profile',
      sub: 'Goals and body basics',
      icon: '🪞',
      tint: 'bg-muted',
    },
    {
      href: '/settings',
      label: 'Settings',
      sub: 'Theme, reminders, privacy',
      icon: '⚙️',
      tint: 'bg-muted',
    },
    {
      href: '/nutrition',
      label: 'Nutrition',
      sub: 'Recipes and approximations',
      icon: '🥗',
      tint: 'bg-sage-soft',
    },
  ];

  return (
    <div className="animate-fade-up space-y-4 py-4">
      <header className="px-1">
        <h1 className="font-display text-display-md">Everything else</h1>
        <p className="mt-1.5 text-[14.5px] text-muted-foreground">
          Your journey, in the long view.
        </p>
      </header>

      <nav aria-label="More destinations">
        <ul className="grid grid-cols-2 gap-3">
          {tiles.map((tile) => (
            <li key={tile.href}>
              <Link
                href={tile.href}
                className="surface-card block h-full p-5 transition-transform active:scale-[0.98] motion-reduce:active:scale-100"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'flex size-9 items-center justify-center rounded-xl text-base',
                    tile.tint,
                  )}
                >
                  {tile.icon}
                </span>
                <span className="mt-3.5 block text-[15px] font-semibold">{tile.label}</span>
                <span className="mt-1 block text-[12.5px] leading-snug text-muted-foreground">
                  {tile.sub}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
