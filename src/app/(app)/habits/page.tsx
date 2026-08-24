import type { Metadata } from 'next';
import Link from 'next/link';
import { ListChecks, Settings2 } from 'lucide-react';

import { Progress } from '@/components/ui/progress';
import { EmptyState } from '@/components/common/empty-state';
import { HabitChecklist } from '@/components/habits/habit-checklist';
import { WaterCard } from '@/components/glow/water-card';
import { StreakStrip, StreakLegend } from '@/components/glow/streak-strip';

import { requireUser } from '@/server/auth';
import { getUserContext } from '@/services/profile';
import { getActiveHabits, getCompletionsForDate, getCompletionsInRange } from '@/services/habits';
import { getDefaultRecipe } from '@/services/nutrition';
import { getDailyMetric, WATER_GOAL_GLASSES } from '@/services/daily';

import {
  attachStatus,
  consistencyRate,
  currentStreak,
  dailyPercentMap,
  longestStreak,
  summariseDay,
} from '@/lib/domain/habits';
import { calculateRecipeNutrition } from '@/lib/domain/nutrition';
import { TONE } from '@/lib/domain/copy';
import { subDaysKey, todayIn } from '@/lib/date';

export const metadata: Metadata = { title: 'Habits' };
export const dynamic = 'force-dynamic';

export default async function HabitsPage() {
  const { supabase, userId } = await requireUser();
  const context = await getUserContext(supabase, userId);

  const today = todayIn(context.profile.timezone);
  const from = subDaysKey(today, 27);

  const [habits, todayCompletions, recentCompletions, defaultRecipe, metric] = await Promise.all([
    getActiveHabits(supabase, userId),
    getCompletionsForDate(supabase, userId, today),
    getCompletionsInRange(supabase, userId, from, today),
    getDefaultRecipe(supabase, userId),
    getDailyMetric(supabase, userId, today),
  ]);

  const habitsWithStatus = attachStatus(habits, todayCompletions);
  const dayProgress = summariseDay(habitsWithStatus);

  const percentMap = dailyPercentMap(habits, recentCompletions, from, today);
  const streak = currentStreak(percentMap, today);
  const best = longestStreak(percentMap, from, today);
  const consistency = consistencyRate(
    recentCompletions,
    habits.filter((h) => h.is_active && !h.is_optional && h.frequency === 'daily').map((h) => h.id),
    from,
    today,
  );

  const recipeNutrition = defaultRecipe ? calculateRecipeNutrition(defaultRecipe.ingredients) : null;
  const habitDetails = Object.fromEntries(
    habitsWithStatus
      .filter((habit) => habit.recipe_id && recipeNutrition)
      .map((habit) => [
        habit.id,
        `≈ ${recipeNutrition!.calories} kcal · ${recipeNutrition!.proteinG} g protein`,
      ]),
  );

  return (
    <div className="animate-fade-up space-y-4 py-4">
      <header className="flex items-start justify-between gap-4 px-1">
        <div>
          <h1 className="font-display text-display-md">Today&rsquo;s habits</h1>
          <p className="mt-1.5 text-[14.5px] text-muted-foreground">
            {dayProgress.required === 0
              ? 'Nothing set up yet.'
              : `${dayProgress.completed} of ${dayProgress.required} complete · small steps add up`}
          </p>
        </div>
        <Link
          href="/settings/habits"
          className="mt-1 flex shrink-0 items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-[12.5px] font-semibold transition-colors hover:bg-muted"
        >
          <Settings2 className="size-3.5" aria-hidden="true" />
          Manage
        </Link>
      </header>

      {habits.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="No habits yet"
          body="Habits are the small daily things this app keeps track of for you. Add a few and they show up here every morning."
          action={
            <Link
              href="/settings/habits"
              className="rounded-full bg-primary px-5 py-3 text-[13.5px] font-semibold text-primary-foreground"
            >
              Set up habits
            </Link>
          }
        />
      ) : (
        <>
          <section aria-labelledby="checklist-heading" className="surface-card p-5">
            <h2 id="checklist-heading" className="sr-only">
              Habit checklist
            </h2>
            {dayProgress.required > 0 ? (
              <Progress
                value={dayProgress.percent}
                className="mb-4 h-1.5"
                aria-label="Today's habit completion"
              />
            ) : null}
            <HabitChecklist
              habits={habitsWithStatus}
              date={today}
              grouped
              detailByHabitId={habitDetails}
            />
            {dayProgress.completed === 0 ? (
              <p className="px-3 pt-3 text-xs text-muted-foreground">{TONE.emptyDay}</p>
            ) : null}
          </section>

          <WaterCard date={today} glasses={metric?.water_glasses ?? 0} goal={WATER_GOAL_GLASSES} />

          <section
            aria-labelledby="streak-heading"
            className="rounded-3xl border border-border-soft bg-primary-soft p-5"
          >
            <h2 id="streak-heading" className="font-display text-display-sm">
              {streak > 0 ? (
                <>
                  <span aria-hidden="true">🔥</span> {streak} day streak
                </>
              ) : (
                'Start a streak today'
              )}
            </h2>
            <p className="mt-1 text-[13.5px] text-muted-foreground">
              {streak > 0
                ? 'Consistency looks good on you.'
                : 'One completed day is all it takes to start one.'}
            </p>

            <StreakStrip
              percentByDate={percentMap}
              from={subDaysKey(today, 13)}
              to={today}
              columns={14}
              className="mt-4"
            />
            <p className="mt-3 text-[12.5px] text-muted-foreground">
              The last 14 days. Best run so far: {best} {best === 1 ? 'day' : 'days'}. Over the last
              four weeks you took {consistency.completed} of {consistency.opportunities}{' '}
              opportunities ({consistency.rate}%).
            </p>
            <StreakLegend className="mt-3" />

            <Link
              href="/streak"
              className="mt-4 inline-flex text-[12.5px] font-semibold text-primary underline-offset-4 hover:underline"
            >
              See the full history
            </Link>
          </section>
        </>
      )}
    </div>
  );
}
