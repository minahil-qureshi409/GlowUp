import type { Enums, Tables } from '@/lib/db/database.types';
import { addDaysKey, dateRangeKeys, subDaysKey, type DateKey } from '@/lib/date';

export type Habit = Tables<'habits'>;
export type HabitCompletion = Tables<'habit_completions'>;

export type HabitWithStatus = Habit & {
  completion: HabitCompletion | null;
  status: Enums<'completion_status'> | null;
};

/** Loose ordering for the day. A hint about sequence, never a schedule. */
const PART_ORDER: Record<Enums<'day_part'>, number> = {
  morning: 0,
  afternoon: 1,
  evening: 2,
  anytime: 3,
};

export function sortHabits<T extends Pick<Habit, 'preferred_part' | 'sort_order' | 'name'>>(
  habits: T[],
): T[] {
  return [...habits].sort((a, b) => {
    const partDelta = PART_ORDER[a.preferred_part] - PART_ORDER[b.preferred_part];
    if (partDelta !== 0) return partDelta;
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return a.name.localeCompare(b.name);
  });
}

export function attachStatus(habits: Habit[], completions: HabitCompletion[]): HabitWithStatus[] {
  const byHabit = new Map(completions.map((c) => [c.habit_id, c]));
  return sortHabits(habits).map((habit) => {
    const completion = byHabit.get(habit.id) ?? null;
    return { ...habit, completion, status: completion?.status ?? null };
  });
}

export type DayProgress = {
  /** Habits that count toward the day: active, daily, and not optional. */
  required: number;
  completed: number;
  skipped: number;
  /** Completed ÷ required, 0–100. 100 when nothing is required. */
  percent: number;
  /** True once every required habit has *some* status — done or consciously skipped. */
  allAddressed: boolean;
};

export function summariseDay(habits: HabitWithStatus[]): DayProgress {
  const counted = habits.filter((h) => h.is_active && !h.is_optional && h.frequency === 'daily');
  const completed = counted.filter((h) => h.status === 'completed' || h.status === 'modified').length;
  const skipped = counted.filter((h) => h.status === 'skipped').length;
  const required = counted.length;

  return {
    required,
    completed,
    skipped,
    percent: required === 0 ? 100 : Math.round((completed / required) * 100),
    allAddressed: required > 0 && completed + skipped === required,
  };
}

/**
 * Consistency over a window, as a percentage of *opportunities* taken.
 *
 * A skip is an opportunity not taken, but it is not a penalty on top — it just
 * isn't a completion. Optional habits are excluded entirely, which is what
 * makes "optional" mean something (the PM moisturiser is the reason).
 */
export function consistencyRate(
  completions: Pick<HabitCompletion, 'habit_id' | 'log_date' | 'status'>[],
  habitIds: string[],
  from: DateKey,
  to: DateKey,
): { rate: number; completed: number; opportunities: number } {
  const days = dateRangeKeys(from, to);
  const opportunities = days.length * habitIds.length;
  if (opportunities === 0) return { rate: 0, completed: 0, opportunities: 0 };

  const wanted = new Set(habitIds);
  const completed = completions.filter(
    (c) =>
      wanted.has(c.habit_id) &&
      c.log_date >= from &&
      c.log_date <= to &&
      (c.status === 'completed' || c.status === 'modified'),
  ).length;

  return {
    rate: Math.round((completed / opportunities) * 100),
    completed,
    opportunities,
  };
}

/** Completed days for one habit across a window, oldest first. */
export function habitDailySeries(
  completions: Pick<HabitCompletion, 'habit_id' | 'log_date' | 'status'>[],
  habitId: string,
  from: DateKey,
  to: DateKey,
): { date: DateKey; done: boolean; skipped: boolean }[] {
  const byDate = new Map(
    completions.filter((c) => c.habit_id === habitId).map((c) => [c.log_date, c.status]),
  );

  return dateRangeKeys(from, to).map((date) => {
    const status = byDate.get(date);
    return {
      date,
      done: status === 'completed' || status === 'modified',
      skipped: status === 'skipped',
    };
  });
}

/**
 * Current streak of days where the day was "kept".
 *
 * A day counts when at least `threshold` of the required habits were completed —
 * not all of them. A streak that snaps because one snack went unlogged is a
 * streak designed to make someone feel bad, which is the opposite of the point.
 *
 * Today is never what breaks a streak: an unfinished today simply doesn't extend
 * it yet, so the number can't drop just because it's 9am.
 */
export function currentStreak(
  dailyPercent: Map<DateKey, number>,
  today: DateKey,
  threshold = 60,
): number {
  let streak = 0;
  let cursor = today;

  const todayPercent = dailyPercent.get(today) ?? 0;
  if (todayPercent >= threshold) {
    streak += 1;
  }
  cursor = subDaysKey(cursor, 1);

  // Walk backwards until a day falls short. Cap the look-back so a very long
  // history can't turn this into an unbounded loop.
  for (let i = 0; i < 730; i += 1) {
    const percent = dailyPercent.get(cursor);
    if (percent === undefined || percent < threshold) break;
    streak += 1;
    cursor = subDaysKey(cursor, 1);
  }

  return streak;
}

export function longestStreak(
  dailyPercent: Map<DateKey, number>,
  from: DateKey,
  to: DateKey,
  threshold = 60,
): number {
  let best = 0;
  let run = 0;
  for (const date of dateRangeKeys(from, to)) {
    if ((dailyPercent.get(date) ?? 0) >= threshold) {
      run += 1;
      best = Math.max(best, run);
    } else {
      run = 0;
    }
  }
  return best;
}

/**
 * Which weekday a habit tends to get done on.
 *
 * Feeds the "you've been most consistent on Wednesdays" suggestion. Returns
 * null unless one day is clearly ahead, so the app doesn't claim a pattern out
 * of three data points.
 */
export function dominantWeekday(
  completions: Pick<HabitCompletion, 'habit_id' | 'log_date' | 'status'>[],
  habitId: string,
): { weekday: number; count: number } | null {
  const counts = new Array<number>(7).fill(0);

  for (const c of completions) {
    if (c.habit_id !== habitId) continue;
    if (c.status !== 'completed' && c.status !== 'modified') continue;
    const day = new Date(`${c.log_date}T00:00:00`).getDay();
    counts[day] = (counts[day] ?? 0) + 1;
  }

  const total = counts.reduce((a, b) => a + b, 0);
  if (total < 6) return null;

  let bestDay = 0;
  let bestCount = 0;
  let runnerUp = 0;
  counts.forEach((count, day) => {
    if (count > bestCount) {
      runnerUp = bestCount;
      bestCount = count;
      bestDay = day;
    } else if (count > runnerUp) {
      runnerUp = count;
    }
  });

  // Needs a real margin, not a one-off lead.
  if (bestCount < 3 || bestCount - runnerUp < 2) return null;
  return { weekday: bestDay, count: bestCount };
}

/** Habits with a poor completion rate over the window — input to suggestions. */
export function strugglingHabits(
  habits: Habit[],
  completions: Pick<HabitCompletion, 'habit_id' | 'log_date' | 'status'>[],
  from: DateKey,
  to: DateKey,
  maxRate = 50,
): { habit: Habit; rate: number }[] {
  return habits
    .filter((h) => h.is_active && !h.is_optional && h.frequency === 'daily')
    .map((habit) => ({
      habit,
      rate: consistencyRate(completions, [habit.id], from, to).rate,
    }))
    .filter((entry) => entry.rate <= maxRate)
    .sort((a, b) => a.rate - b.rate);
}

/** Per-day completion percentages across a window, for streaks and heatmaps. */
export function dailyPercentMap(
  habits: Habit[],
  completions: Pick<HabitCompletion, 'habit_id' | 'log_date' | 'status'>[],
  from: DateKey,
  to: DateKey,
): Map<DateKey, number> {
  const required = habits.filter(
    (h) => h.is_active && !h.is_optional && h.frequency === 'daily',
  );
  const requiredIds = new Set(required.map((h) => h.id));
  const result = new Map<DateKey, number>();

  if (required.length === 0) return result;

  const byDate = new Map<DateKey, number>();
  for (const c of completions) {
    if (!requiredIds.has(c.habit_id)) continue;
    if (c.status !== 'completed' && c.status !== 'modified') continue;
    byDate.set(c.log_date, (byDate.get(c.log_date) ?? 0) + 1);
  }

  for (const date of dateRangeKeys(from, to)) {
    const done = byDate.get(date) ?? 0;
    result.set(date, Math.round((done / required.length) * 100));
  }

  return result;
}

/** Rolling seven-day window ending on (and including) `to`. */
export function lastSevenDays(to: DateKey): { from: DateKey; to: DateKey } {
  return { from: subDaysKey(to, 6), to };
}

export function nextDay(date: DateKey): DateKey {
  return addDaysKey(date, 1);
}
