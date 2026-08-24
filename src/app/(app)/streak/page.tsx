import type { Metadata } from 'next';
import { Check } from 'lucide-react';

import { StreakStrip, StreakLegend } from '@/components/glow/streak-strip';

import { requireUser } from '@/server/auth';
import { getUserContext } from '@/services/profile';
import { getActiveHabits, getCompletionsInRange } from '@/services/habits';

import { currentStreak, dailyPercentMap, longestStreak } from '@/lib/domain/habits';
import { subDaysKey, todayIn } from '@/lib/date';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Streak' };
export const dynamic = 'force-dynamic';

const MILESTONES = [
  { days: 7, name: 'First week' },
  { days: 14, name: 'Two weeks' },
  { days: 30, name: 'One month' },
  { days: 60, name: 'Two months' },
  { days: 100, name: 'One hundred days' },
  { days: 365, name: 'A full year' },
];

export default async function StreakPage() {
  const { supabase, userId } = await requireUser();
  const context = await getUserContext(supabase, userId);

  const today = todayIn(context.profile.timezone);
  const from = subDaysKey(today, 55); // eight weeks of seven

  const [habits, completions] = await Promise.all([
    getActiveHabits(supabase, userId),
    getCompletionsInRange(supabase, userId, from, today),
  ]);

  const percentMap = dailyPercentMap(habits, completions, from, today);
  const streak = currentStreak(percentMap, today);
  const best = longestStreak(percentMap, from, today);
  const keptDays = [...percentMap.values()].filter((p) => p >= 60).length;

  return (
    <div className="animate-fade-up space-y-4 py-4">
      <section className="rounded-[2rem] border border-border-soft bg-gradient-to-b from-primary-soft to-accent px-6 py-8 text-center">
        <p aria-hidden="true" className="animate-breathe text-[44px] leading-none">
          🔥
        </p>
        <h1 className="mt-3 font-display text-display-lg">
          {streak > 0 ? `${streak} day streak` : 'No streak yet'}
        </h1>
        <p className="mt-2.5 text-[14.5px] text-muted-foreground">
          {streak > 0
            ? 'Consistency looks good on you.'
            : 'Complete most of a day and this starts counting.'}
        </p>
        <p className="mt-4 text-[12.5px] text-subtle">
          A day counts when you complete at least 60% of what you set for yourself. One missed
          snack has never broken a streak here.
        </p>
      </section>

      <section aria-labelledby="milestones-heading">
        <h2 id="milestones-heading" className="mb-3 px-1 text-[16.5px] font-semibold tracking-tight">
          Milestones
        </h2>
        <ol className="space-y-2.5">
          {MILESTONES.map((milestone) => {
            const reached = best >= milestone.days;
            const remaining = milestone.days - streak;

            return (
              <li
                key={milestone.days}
                className="surface-card flex items-center gap-4 px-5 py-4"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-full border text-[13px] font-semibold',
                    reached
                      ? 'border-sage bg-sage text-background'
                      : 'border-border text-subtle',
                  )}
                >
                  {reached ? <Check className="size-4" strokeWidth={3} /> : milestone.days}
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      'text-[14.5px] font-semibold',
                      reached ? 'text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    {milestone.name}
                  </p>
                  <p className="text-[12.5px] text-subtle">
                    {reached
                      ? 'Reached'
                      : remaining > 0 && streak > 0
                        ? `${remaining} ${remaining === 1 ? 'day' : 'days'} to go`
                        : `${milestone.days} days`}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-labelledby="history-heading" className="surface-card p-5">
        <h2 id="history-heading" className="text-[16.5px] font-semibold tracking-tight">
          Last 8 weeks
        </h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          {keptDays} of the last 56 days kept. Longest run so far: {best}{' '}
          {best === 1 ? 'day' : 'days'}.
        </p>

        <StreakStrip percentByDate={percentMap} from={from} to={today} columns={14} className="mt-4" />
        <StreakLegend className="mt-3.5" />
      </section>
    </div>
  );
}
