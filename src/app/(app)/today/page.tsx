import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { Progress } from '@/components/ui/progress';
import { HabitChecklist } from '@/components/habits/habit-checklist';
import { SuggestionCard } from '@/components/today/suggestion-card';
import { GreetingHeader } from '@/components/today/greeting-header';
import { DayContextCard } from '@/components/today/day-context-card';
import { GlowScoreCard } from '@/components/glow/glow-score-card';
import { VitalsRow } from '@/components/glow/vitals-row';
import { WaterCard } from '@/components/glow/water-card';
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
import { getEntriesForDate, getRoutines } from '@/services/skincare';
import { getBusyBlocksForDate } from '@/services/calendar';
import { getDefaultRecipe } from '@/services/nutrition';
import { getDailyMetric, WATER_GOAL_GLASSES } from '@/services/daily';

import { attachStatus, summariseDay, dailyPercentMap, currentStreak } from '@/lib/domain/habits';
import { buildDailyPlan } from '@/lib/domain/planner';
import { buildInsights } from '@/lib/domain/insights';
import { summariseWeight } from '@/lib/domain/weight';
import { calculateRecipeNutrition } from '@/lib/domain/nutrition';
import { workoutsThisWeek } from '@/lib/domain/workout';
import { buildGlowSummary, energyFromSleep, MOOD_LABELS } from '@/lib/domain/glow';
import { TONE } from '@/lib/domain/copy';
import { daysBetween, subDaysKey, todayIn } from '@/lib/date';
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
    routines,
    busy,
    dismissed,
    defaultRecipe,
    metric,
  ] = await Promise.all([
    getActiveHabits(supabase, userId),
    getCompletionsForDate(supabase, userId, today),
    getCompletionsInRange(supabase, userId, thirtyDaysAgo, today),
    getWeightEntries(supabase, userId, { from: subDaysKey(today, 120) }),
    getLatestWeightEntry(supabase, userId),
    getWeightGoal(supabase, userId),
    getWorkouts(supabase, userId, { from: subDaysKey(today, 27) }),
    getEntriesForDate(supabase, userId, today),
    getRoutines(supabase, userId),
    getBusyBlocksForDate(supabase, userId, today, timezone),
    getDismissedSuggestions(supabase, userId, today),
    getDefaultRecipe(supabase, userId),
    getDailyMetric(supabase, userId, today),
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

  const completedThisWeek = workoutsThisWeek(recentWorkouts, today);
  const workoutLoggedToday = recentWorkouts.some(
    (workout) => workout.workout_date === today && workout.status === 'completed',
  );

  const skincareAmDone = skincareToday.some((e) => e.period === 'am' && e.status === 'completed');
  const skincarePmDone = skincareToday.some((e) => e.period === 'pm' && e.status === 'completed');

  // Steps across both routines, so the pillar reflects the ritual rather than
  // a coarse done/not-done per period.
  const skincareRequired = routines.reduce(
    (total, routine) => total + routine.steps.filter((step) => !step.is_optional).length,
    0,
  );
  const skincareCompleted = skincareToday.reduce(
    (total, entry) =>
      total +
      entry.step_completions.filter((c) => c.status === 'completed' || c.status === 'modified')
        .length,
    0,
  );

  const glow = buildGlowSummary({
    habits: habitsWithStatus,
    workoutsCompletedThisWeek: completedThisWeek,
    workoutsPerWeek: context.settings.workouts_per_week,
    workoutLoggedToday,
    skincare: {
      required: skincareRequired,
      completed: Math.min(skincareCompleted, skincareRequired),
    },
    sleepHours: metric?.sleep_hours ?? null,
    waterGlasses: metric?.water_glasses ?? 0,
    waterGoal: WATER_GOAL_GLASSES,
  });

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
      .map((habit) => [
        habit.id,
        `≈ ${recipeNutrition!.calories} kcal · ${recipeNutrition!.proteinG} g protein`,
      ]),
  );

  const energy = energyFromSleep(metric?.sleep_hours ?? null);
  const vitals = [
    {
      label: 'Streak',
      value: streak > 0 ? String(streak) : '—',
      hint: streak === 1 ? 'day' : 'days',
    },
    {
      label: 'Mood',
      value: metric?.mood ? (MOOD_LABELS[metric.mood] ?? '—') : '—',
      hint: metric?.mood ? 'you logged' : 'not logged',
    },
    { label: 'Energy', value: energy.label, hint: energy.hint },
  ];

  const subGreeting =
    dayProgress.completed >= 3
      ? "You're on a roll today."
      : dayProgress.completed > 0
        ? 'Nicely started.'
        : "Let's make today count.";

  return (
    <div className="animate-fade-up space-y-4 py-4">
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
        subGreeting={subGreeting}
      />

      <GlowScoreCard summary={glow} />

      <VitalsRow vitals={vitals} />

      {/* ── priorities ──────────────────────────────────────────────────── */}
      {cards.length > 0 ? (
        <section aria-labelledby="priorities-heading" className="space-y-2.5 pt-3">
          <div className="flex items-baseline justify-between px-1">
            <h2 id="priorities-heading" className="text-[16.5px] font-semibold tracking-tight">
              Today&rsquo;s priorities
            </h2>
            <span className="text-xs text-subtle">
              {cards.length} for today
            </span>
          </div>
          {cards.map((card) => (
            <SuggestionCard key={card.key} suggestion={card} today={today} />
          ))}
        </section>
      ) : null}

      <WaterCard
        date={today}
        glasses={metric?.water_glasses ?? 0}
        goal={WATER_GOAL_GLASSES}
      />

      {/* ── day context ─────────────────────────────────────────────────── */}
      <DayContextCard
        plan={plan}
        timeFormat={context.profile.time_format}
        calendarConnected={context.calendarConnected}
      />

      {/* ── today's habits ──────────────────────────────────────────────── */}
      <section aria-labelledby="habits-heading" className="surface-card p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 id="habits-heading" className="text-[16.5px] font-semibold tracking-tight">
              Today&rsquo;s habits
            </h2>
            <p className="text-[13px] text-muted-foreground">
              {dayProgress.required === 0
                ? 'No habits set up yet'
                : `${dayProgress.completed} of ${dayProgress.required} complete · small steps add up`}
            </p>
          </div>
          {dayProgress.required > 0 ? (
            <span className="tabular text-sm font-semibold text-muted-foreground">
              {dayProgress.percent}%
            </span>
          ) : null}
        </div>

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

      {/* ── weight ──────────────────────────────────────────────────────── */}
      <section aria-labelledby="weight-heading" className="surface-card overflow-hidden">
        <div className="bg-gradient-veil p-5">
          <p className="eyebrow" id="weight-heading">
            Weight
          </p>
          <div className="mt-2 flex items-end gap-2">
            <span className="tabular font-display text-display-lg leading-none">
              {formatWeightNumber(summary.current)}
            </span>
            <span className="pb-1 text-base text-subtle">kg</span>
          </div>
          <p className="mt-2.5 text-sm text-muted-foreground">
            {summary.goal ? `Goal ${summary.goal} kg` : 'No goal set yet'}
            {summary.weeklyChangeKg !== null ? (
              <span className="tabular ml-2 font-semibold text-sage-ink">
                {formatDelta(summary.weeklyChangeKg)} this week
              </span>
            ) : null}
          </p>
        </div>

        <div className="flex gap-2 border-t border-border-soft p-4">
          <LogWeightDialog
            today={today}
            lastWeightKg={summary.current}
            trigger={
              <button
                type="button"
                className="flex-1 rounded-2xl bg-primary px-5 py-3.5 text-[14.5px] font-semibold text-primary-foreground transition-transform active:scale-[0.985] motion-reduce:active:scale-100"
              >
                Log today&rsquo;s weight
              </button>
            }
          />
          <Link
            href="/weight"
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-border bg-card px-5 py-3.5 text-[14.5px] font-semibold transition-colors hover:bg-muted"
          >
            Journey
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </section>
    </div>
  );
}
