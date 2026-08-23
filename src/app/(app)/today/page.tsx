import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Dumbbell, Sparkles } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ProgressRing } from '@/components/common/progress-ring';
import { HabitChecklist } from '@/components/habits/habit-checklist';
import { SuggestionCard } from '@/components/today/suggestion-card';
import { GreetingHeader } from '@/components/today/greeting-header';
import { DayContextCard } from '@/components/today/day-context-card';
import { LogWeightDialog } from '@/components/weight/log-weight-dialog';
import { ReminderScheduler } from '@/components/reminders/reminder-scheduler';

import { requireUser } from '@/server/auth';
import { getUserContext } from '@/services/profile';
import {
  getActiveHabits,
  getCompletionsForDate,
  getCompletionsInRange,
  getDismissedSuggestions,
} from '@/services/habits';
import { getLatestWeightEntry, getWeightEntries, getWeightGoal } from '@/services/weight';
import { getWorkouts } from '@/services/workouts';
import { getEntriesForDate } from '@/services/skincare';
import { getBusyBlocksForDate } from '@/services/calendar';
import { getDefaultRecipe } from '@/services/nutrition';

import { attachStatus, summariseDay, dailyPercentMap, currentStreak } from '@/lib/domain/habits';
import { buildDailyPlan } from '@/lib/domain/planner';
import { buildInsights } from '@/lib/domain/insights';
import { summariseWeight, progressMilestones } from '@/lib/domain/weight';
import { calculateRecipeNutrition } from '@/lib/domain/nutrition';
import { workoutsThisWeek } from '@/lib/domain/workout';
import { TONE } from '@/lib/domain/copy';
import { daysBetween, subDaysKey, todayIn, weekStartKey } from '@/lib/date';
import { formatDelta, formatWeightNumber } from '@/lib/format';

export const metadata: Metadata = { title: 'Today' };

// Every read is user-scoped and time-sensitive; nothing here is cacheable.
export const dynamic = 'force-dynamic';

export default async function TodayPage() {
  const { supabase, userId } = await requireUser();
  const context = await getUserContext(supabase, userId);

  const now = new Date();
  const timezone = context.profile.timezone;
  const today = todayIn(timezone, now);
  const weekStart = weekStartKey(today);
  const thirtyDaysAgo = subDaysKey(today, 29);

  const [
    habits,
    todayCompletions,
    recentCompletions,
    weightEntries,
    latestWeight,
    weightGoal,
    recentWorkouts,
    skincareToday,
    busy,
    dismissed,
    defaultRecipe,
  ] = await Promise.all([
    getActiveHabits(supabase, userId),
    getCompletionsForDate(supabase, userId, today),
    getCompletionsInRange(supabase, userId, thirtyDaysAgo, today),
    getWeightEntries(supabase, userId, { from: subDaysKey(today, 120) }),
    getLatestWeightEntry(supabase, userId),
    getWeightGoal(supabase, userId),
    getWorkouts(supabase, userId, { from: subDaysKey(today, 27) }),
    getEntriesForDate(supabase, userId, today),
    getBusyBlocksForDate(supabase, userId, today, timezone),
    getDismissedSuggestions(supabase, userId, today),
    getDefaultRecipe(supabase, userId),
  ]);

  const habitsWithStatus = attachStatus(habits, todayCompletions);
  const dayProgress = summariseDay(habitsWithStatus);

  const percentMap = dailyPercentMap(habits, recentCompletions, thirtyDaysAgo, today);
  const streak = currentStreak(percentMap, today);

  const summary = summariseWeight(weightEntries, {
    goalKg: weightGoal.goal?.target_value ?? null,
    startKg: weightGoal.goal?.start_value ?? null,
    today,
  });

  const milestones = progressMilestones(
    weightGoal.milestones.map((m) => ({
      id: m.id,
      label: m.label,
      targetKg: m.target_value,
      achievedAt: m.achieved_at,
    })),
    summary.current,
  );
  const nextMilestone = milestones.find((m) => m.isNext) ?? null;

  const completedThisWeek = workoutsThisWeek(recentWorkouts, today);
  const workoutLoggedToday = recentWorkouts.some(
    (workout) => workout.workout_date === today && workout.status === 'completed',
  );

  const skincareAmDone = skincareToday.some((e) => e.period === 'am' && e.status === 'completed');
  const skincarePmDone = skincareToday.some((e) => e.period === 'pm' && e.status === 'completed');

  const daysSinceLastWeighIn = latestWeight ? daysBetween(latestWeight.entry_date, today) : null;

  const plan = buildDailyPlan({
    now,
    timezone,
    today,
    displayName: context.profile.display_name,
    settings: context.settings,
    gym: context.gym,
    busy,
    hasCalendar: context.calendarConnected,
    habits: habitsWithStatus,
    workoutsCompletedThisWeek: completedThisWeek,
    workoutLoggedToday,
    skincareAmDone,
    skincarePmDone,
    daysSinceLastWeighIn,
    dismissedKeys: dismissed,
  });

  const insights = context.settings.suggestions_enabled
    ? buildInsights({
        today,
        habits,
        completions: recentCompletions,
        weightEntries,
        skincareEntries: [],
        workouts: recentWorkouts,
        workoutsPerWeek: context.settings.workouts_per_week,
        preferredWorkoutDays: context.settings.preferred_workout_days,
        dismissedKeys: dismissed,
      })
    : [];

  // At most three cards total, planner first — a wall of advice is nagging.
  const cards = [...plan.suggestions, ...insights].slice(0, 3);

  const recipeNutrition = defaultRecipe ? calculateRecipeNutrition(defaultRecipe.ingredients) : null;
  const habitDetails = Object.fromEntries(
    habitsWithStatus
      .filter((habit) => habit.recipe_id && recipeNutrition)
      .map((habit) => [habit.id, `≈ ${recipeNutrition!.calories} kcal · ${recipeNutrition!.proteinG} g protein`]),
  );
  const workoutTarget = context.settings.workouts_per_week;

  return (
    <div className="animate-fade-up space-y-5 py-3">
      {/*
        Renders nothing. Lives here rather than in the layout so it always has
        today's habit statuses and busy blocks to reason about.
      */}
      <ReminderScheduler
        settings={context.settings}
        timezone={timezone}
        today={today}
        habits={habitsWithStatus}
        busy={busy}
        dayShape={plan.dayShape}
      />

      <GreetingHeader
        displayName={context.profile.display_name}
        timezone={timezone}
        timeFormat={context.profile.time_format}
        fallbackGreeting={plan.greeting}
      />

      {/* ── weight hero ─────────────────────────────────────────────────── */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-veil">
          <CardContent className="flex items-center gap-5 p-5">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-baseline gap-1.5">
                <span className="font-display text-display-md leading-none">
                  {formatWeightNumber(summary.current)}
                </span>
                <span className="text-base text-muted-foreground">kg</span>
              </div>

              <p className="text-sm text-muted-foreground">
                {summary.goal ? `Goal ${summary.goal} kg` : 'No goal set yet'}
                {summary.weeklyChangeKg !== null ? (
                  <span className="ml-2 tabular">
                    {formatDelta(summary.weeklyChangeKg)} this week
                  </span>
                ) : null}
              </p>

              {nextMilestone && summary.current !== null ? (
                <p className="pt-1 text-xs text-muted-foreground">
                  Next milestone {nextMilestone.targetKg} kg
                </p>
              ) : null}
            </div>

            <ProgressRing
              value={summary.percentToGoal ?? 0}
              size={92}
              strokeWidth={9}
              label={
                summary.percentToGoal !== null
                  ? `${Math.round(summary.percentToGoal)}% of the way from your starting weight to your goal`
                  : 'Not enough data for goal progress yet'
              }
            >
              <span className="tabular font-display text-xl font-semibold leading-none">
                {summary.percentToGoal !== null ? `${Math.round(summary.percentToGoal)}%` : '—'}
              </span>
            </ProgressRing>
          </CardContent>
        </div>

        <CardContent className="flex gap-2 border-t border-border/60 p-4">
          <LogWeightDialog
            today={today}
            lastWeightKg={summary.current}
            trigger={
              <Button variant="brand" className="flex-1">
                Log weight
              </Button>
            }
          />
          <Button variant="outline" asChild className="flex-1">
            <Link href="/progress">
              Progress
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* ── suggestions ─────────────────────────────────────────────────── */}
      {cards.length > 0 ? (
        <section aria-label="Suggestions" className="space-y-2">
          {cards.map((card) => (
            <SuggestionCard key={card.key} suggestion={card} today={today} />
          ))}
        </section>
      ) : null}

      {/* ── day context ─────────────────────────────────────────────────── */}
      <DayContextCard
        plan={plan}
        timeFormat={context.profile.time_format}
        calendarConnected={context.calendarConnected}
      />

      {/* ── today's habits ──────────────────────────────────────────────── */}
      <Card>
        <CardContent className="p-4">
          <div className="mb-2 flex items-center justify-between gap-3 px-1">
            <div>
              <h2 className="text-sm font-semibold tracking-tight">Today</h2>
              <p className="text-xs text-muted-foreground">
                {dayProgress.required === 0
                  ? 'No habits set up yet'
                  : `${dayProgress.completed} of ${dayProgress.required} done`}
                {streak > 1 ? ` · ${streak} day streak` : ''}
              </p>
            </div>
            {dayProgress.required > 0 ? (
              <span className="tabular text-sm font-medium text-muted-foreground">
                {dayProgress.percent}%
              </span>
            ) : null}
          </div>

          {dayProgress.required > 0 ? (
            <Progress
              value={dayProgress.percent}
              className="mb-3 h-1.5"
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
        </CardContent>
      </Card>

      {/* ── workout + skincare summary ──────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center gap-2">
              <Dumbbell className="size-4 text-domain-workout" aria-hidden="true" />
              <h2 className="text-sm font-semibold">Workout</h2>
            </div>
            <p className="tabular font-display text-2xl leading-none">
              {completedThisWeek} <span className="text-base text-muted-foreground">/ {workoutTarget}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              this week · week of {weekStart.slice(8)}/{weekStart.slice(5, 7)}
            </p>
            <Progress
              value={workoutTarget === 0 ? 100 : Math.min(100, (completedThisWeek / workoutTarget) * 100)}
              className="h-1.5"
              aria-label={`${completedThisWeek} of ${workoutTarget} workouts this week`}
            />
            <Button variant="outline" size="sm" asChild className="w-full">
              <Link href="/workout">Open workouts</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-domain-skincare" aria-hidden="true" />
              <h2 className="text-sm font-semibold">Skincare</h2>
            </div>
            <dl className="space-y-1.5 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Morning</dt>
                <dd className="font-medium">{skincareAmDone ? 'Done ✓' : 'Open'}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Evening</dt>
                <dd className="font-medium">{skincarePmDone ? 'Done ✓' : 'Open'}</dd>
              </div>
            </dl>
            <Button variant="outline" size="sm" asChild className="w-full">
              <Link href="/skincare">Open routines</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
