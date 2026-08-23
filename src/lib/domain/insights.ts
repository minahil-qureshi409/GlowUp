import type { Tables } from '@/lib/db/database.types';
import { DAY_NAMES, subDaysKey, type DateKey } from '@/lib/date';
import {
  consistencyRate,
  dominantWeekday,
  strugglingHabits,
  type Habit,
  type HabitCompletion,
} from '@/lib/domain/habits';
import { periodConsistency, type SkincareEntry } from '@/lib/domain/skincare';
import { readTrendSignal, type WeightEntry } from '@/lib/domain/weight';
import { DOWNWARD_TREND_NOTE, STALL_NOTE } from '@/lib/domain/copy';

/**
 * Behavioural suggestions.
 *
 * These read what the user actually did over weeks, not what a plan said they
 * should do. Every one is phrased as a question or an observation, carries a
 * stable key so it can be dismissed, and disappears once the pattern behind it
 * goes away.
 *
 * Deliberately capped: three at a time, ranked by how actionable they are.
 * A wall of advice is nagging with extra steps.
 */

export type InsightAction =
  | { kind: 'set-preferred-day'; weekday: number }
  | { kind: 'navigate'; href: string }
  | { kind: 'none' };

export type Insight = {
  key: string;
  title: string;
  body: string;
  tone: 'neutral' | 'positive' | 'gentle';
  action: InsightAction;
  actionLabel?: string;
  /** Higher shows first. */
  weight: number;
};

export type InsightInput = {
  today: DateKey;
  habits: Habit[];
  completions: Pick<HabitCompletion, 'habit_id' | 'log_date' | 'status'>[];
  weightEntries: WeightEntry[];
  skincareEntries: Pick<SkincareEntry, 'log_date' | 'period' | 'status'>[];
  workouts: Pick<Tables<'workouts'>, 'workout_date' | 'status'>[];
  workoutsPerWeek: number;
  preferredWorkoutDays: number[];
  dismissedKeys: ReadonlySet<string>;
};

export function buildInsights(input: InsightInput): Insight[] {
  const insights: Insight[] = [];
  const fourWeeksAgo = subDaysKey(input.today, 27);
  const twoWeeksAgo = subDaysKey(input.today, 13);
  const weekAgo = subDaysKey(input.today, 6);

  // ── weight trend ───────────────────────────────────────────────────────────
  const trend = readTrendSignal(input.weightEntries, {
    today: input.today,
    weeks: 3,
    goalDirection: 'gain',
  });

  if (trend.kind === 'flat') {
    insights.push({
      key: 'weight-flat',
      title: 'Trend has been level',
      body: STALL_NOTE,
      tone: 'neutral',
      action: { kind: 'navigate', href: '/nutrition' },
      actionLabel: 'Review nutrition habits',
      weight: 70,
    });
  } else if (trend.kind === 'declining') {
    insights.push({
      key: 'weight-declining',
      title: 'Trend has been heading down',
      body: DOWNWARD_TREND_NOTE,
      tone: 'gentle',
      action: { kind: 'none' },
      weight: 95,
    });
  }

  // ── a habit that keeps slipping ────────────────────────────────────────────
  // Two full weeks of data before saying anything, so a single odd week is not
  // turned into a pattern.
  const struggling = strugglingHabits(
    input.habits,
    input.completions,
    twoWeeksAgo,
    input.today,
    45,
  );
  const worst = struggling[0];

  if (worst && input.completions.length >= 10) {
    const isMorning = worst.habit.preferred_part === 'morning';
    const isShake = /shake/i.test(worst.habit.name);

    insights.push({
      key: `habit-slipping-${worst.habit.id}`,
      title: `${worst.habit.name} has been hard to fit in`,
      body:
        isMorning && isShake
          ? 'Would prepping it the night before make the mornings easier?'
          : isMorning
            ? 'Mornings look tight. Would moving this later in the day help?'
            : 'Would a different time of day suit this better?',
      tone: 'gentle',
      action: { kind: 'navigate', href: '/settings/habits' },
      actionLabel: 'Adjust this habit',
      weight: 60,
    });
  }

  // ── a weekday that reliably works for workouts ─────────────────────────────
  const workoutHabit = input.habits.find((h) => h.category === 'workout');
  if (workoutHabit) {
    const dominant = dominantWeekday(input.completions, workoutHabit.id);
    if (dominant && !input.preferredWorkoutDays.includes(dominant.weekday)) {
      const dayName = DAY_NAMES[dominant.weekday] ?? 'that day';
      insights.push({
        key: `workout-preferred-day-${dominant.weekday}`,
        title: `${dayName}s have been working for you`,
        body: `You've trained on ${dayName}s ${dominant.count} times. Keep it as a preferred day?`,
        tone: 'positive',
        action: { kind: 'set-preferred-day', weekday: dominant.weekday },
        actionLabel: `Prefer ${dayName}s`,
        weight: 50,
      });
    }
  }

  // ── workout frequency over the last four weeks ─────────────────────────────
  const recentWorkouts = input.workouts.filter(
    (w) => w.status === 'completed' && w.workout_date >= fourWeeksAgo,
  );
  if (recentWorkouts.length >= 4) {
    const perWeek = recentWorkouts.length / 4;
    if (perWeek >= input.workoutsPerWeek) {
      insights.push({
        key: 'workout-holding',
        title: 'Training has been steady',
        body: `About ${perWeek.toFixed(1)} sessions a week over the last month.`,
        tone: 'positive',
        action: { kind: 'none' },
        weight: 30,
      });
    }
  }

  // ── skincare consistency ───────────────────────────────────────────────────
  const pm = periodConsistency(input.skincareEntries, 'pm', weekAgo, input.today);
  const am = periodConsistency(input.skincareEntries, 'am', weekAgo, input.today);

  if (am.completedDays + pm.completedDays >= 5) {
    if (pm.rate >= 85 && am.rate >= 85) {
      insights.push({
        key: 'skincare-strong',
        title: 'Skincare has been very consistent',
        body: `Morning ${am.completedDays}/${am.totalDays}, evening ${pm.completedDays}/${pm.totalDays} this week.`,
        tone: 'positive',
        action: { kind: 'none' },
        weight: 25,
      });
    } else if (pm.rate <= 40 && am.rate >= 70) {
      insights.push({
        key: 'skincare-pm-light',
        title: 'Evenings are lighter than mornings',
        body: 'Evening routines are easy to lose at the end of a long day. A shorter version still counts.',
        tone: 'gentle',
        action: { kind: 'navigate', href: '/skincare' },
        actionLabel: 'Open skincare',
        weight: 40,
      });
    }
  }

  // ── nutrition week over week ───────────────────────────────────────────────
  const nutritionIds = input.habits
    .filter((h) => h.category === 'nutrition' && h.is_active && !h.is_optional)
    .map((h) => h.id);

  if (nutritionIds.length > 0) {
    const thisWeek = consistencyRate(input.completions, nutritionIds, weekAgo, input.today);
    if (thisWeek.completed >= 5 && thisWeek.rate >= 80) {
      insights.push({
        key: 'nutrition-strong',
        title: 'Food habits held together this week',
        body: `${thisWeek.completed} of ${thisWeek.opportunities} logged.`,
        tone: 'positive',
        action: { kind: 'none' },
        weight: 20,
      });
    }
  }

  return insights
    .filter((i) => !input.dismissedKeys.has(i.key))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3);
}
