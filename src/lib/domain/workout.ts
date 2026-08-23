import type { Enums, Tables } from '@/lib/db/database.types';
import { dateRangeKeys, weekStartKey, type DateKey } from '@/lib/date';

export type Exercise = Tables<'exercises'>;
export type Workout = Tables<'workouts'>;
export type ExerciseSet = Tables<'exercise_sets'>;

export type LoggedSet = Pick<ExerciseSet, 'reps' | 'weight_kg' | 'is_warmup' | 'completed'>;

export type SetWithContext = LoggedSet & {
  exerciseId: string;
  workoutId: string;
  date: DateKey;
};

/** Working volume: warm-ups and unfinished sets don't count toward the total. */
export function setVolume(set: LoggedSet): number {
  if (set.is_warmup || !set.completed) return 0;
  const reps = set.reps ?? 0;
  const weight = set.weight_kg ?? 0;
  return reps * weight;
}

export function totalVolume(sets: LoggedSet[]): number {
  return sets.reduce((acc, set) => acc + setVolume(set), 0);
}

/**
 * Estimated one-rep max (Epley).
 *
 * Used only to compare sets against each other over time — a 5×40 kg session
 * and an 8×35 kg session are otherwise hard to rank. It is never shown as a
 * lift the user should attempt, and never suggested as a target.
 */
export function estimatedOneRepMax(set: LoggedSet): number | null {
  if (set.is_warmup || !set.completed) return null;
  const reps = set.reps ?? 0;
  const weight = set.weight_kg ?? 0;
  if (reps <= 0 || weight <= 0) return null;
  if (reps === 1) return weight;
  // Beyond ~12 reps the formula stops meaning much, so cap the extrapolation.
  const cappedReps = Math.min(reps, 12);
  return Number((weight * (1 + cappedReps / 30)).toFixed(1));
}

export type PersonalBest = {
  exerciseId: string;
  /** Heaviest completed working set. */
  bestWeightKg: number | null;
  bestWeightReps: number | null;
  bestWeightDate: DateKey | null;
  /** Best estimated 1RM, which can come from a lighter but higher-rep set. */
  bestE1rm: number | null;
  bestE1rmDate: DateKey | null;
  /** Highest single-session volume for this exercise. */
  bestSessionVolume: number | null;
  bestSessionVolumeDate: DateKey | null;
};

export function personalBests(sets: SetWithContext[]): Map<string, PersonalBest> {
  const result = new Map<string, PersonalBest>();
  const sessionVolume = new Map<string, { volume: number; date: DateKey; exerciseId: string }>();

  for (const set of sets) {
    if (set.is_warmup || !set.completed) continue;

    const existing: PersonalBest = result.get(set.exerciseId) ?? {
      exerciseId: set.exerciseId,
      bestWeightKg: null,
      bestWeightReps: null,
      bestWeightDate: null,
      bestE1rm: null,
      bestE1rmDate: null,
      bestSessionVolume: null,
      bestSessionVolumeDate: null,
    };

    const weight = set.weight_kg ?? 0;
    if (weight > 0 && (existing.bestWeightKg === null || weight > existing.bestWeightKg)) {
      existing.bestWeightKg = weight;
      existing.bestWeightReps = set.reps;
      existing.bestWeightDate = set.date;
    }

    const e1rm = estimatedOneRepMax(set);
    if (e1rm !== null && (existing.bestE1rm === null || e1rm > existing.bestE1rm)) {
      existing.bestE1rm = e1rm;
      existing.bestE1rmDate = set.date;
    }

    result.set(set.exerciseId, existing);

    const key = `${set.workoutId}:${set.exerciseId}`;
    const bucket = sessionVolume.get(key) ?? {
      volume: 0,
      date: set.date,
      exerciseId: set.exerciseId,
    };
    bucket.volume += setVolume(set);
    sessionVolume.set(key, bucket);
  }

  for (const bucket of sessionVolume.values()) {
    const existing = result.get(bucket.exerciseId);
    if (!existing) continue;
    if (existing.bestSessionVolume === null || bucket.volume > existing.bestSessionVolume) {
      existing.bestSessionVolume = Math.round(bucket.volume);
      existing.bestSessionVolumeDate = bucket.date;
    }
  }

  return result;
}

export type ProgressionPoint = {
  date: DateKey;
  topSetKg: number | null;
  estimatedOneRepMax: number | null;
  volume: number;
  totalReps: number;
};

/** Per-session progression for one exercise, oldest first. */
export function exerciseProgression(sets: SetWithContext[], exerciseId: string): ProgressionPoint[] {
  const byWorkout = new Map<string, { date: DateKey; sets: SetWithContext[] }>();

  for (const set of sets) {
    if (set.exerciseId !== exerciseId) continue;
    if (set.is_warmup || !set.completed) continue;
    const bucket = byWorkout.get(set.workoutId) ?? { date: set.date, sets: [] };
    bucket.sets.push(set);
    byWorkout.set(set.workoutId, bucket);
  }

  return [...byWorkout.values()]
    .map(({ date, sets: sessionSets }) => {
      const weights = sessionSets.map((s) => s.weight_kg ?? 0).filter((w) => w > 0);
      const e1rms = sessionSets
        .map(estimatedOneRepMax)
        .filter((value): value is number => value !== null);

      return {
        date,
        topSetKg: weights.length > 0 ? Math.max(...weights) : null,
        estimatedOneRepMax: e1rms.length > 0 ? Math.max(...e1rms) : null,
        volume: Math.round(totalVolume(sessionSets)),
        totalReps: sessionSets.reduce((acc, s) => acc + (s.reps ?? 0), 0),
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

export type StrengthChange = {
  exerciseId: string;
  fromKg: number;
  toKg: number;
  deltaKg: number;
  weeks: number;
};

/**
 * Load change for an exercise across a window.
 *
 * Compares the first and last session's top set. Returns null unless there are
 * at least two sessions — one data point is not a trend.
 */
export function strengthChange(
  sets: SetWithContext[],
  exerciseId: string,
  from: DateKey,
  to: DateKey,
): StrengthChange | null {
  const points = exerciseProgression(sets, exerciseId).filter(
    (p) => p.date >= from && p.date <= to && p.topSetKg !== null,
  );
  if (points.length < 2) return null;

  const first = points[0];
  const last = points[points.length - 1];
  if (!first?.topSetKg || !last?.topSetKg) return null;

  const days = dateRangeKeys(first.date, last.date).length;
  return {
    exerciseId,
    fromKg: first.topSetKg,
    toKg: last.topSetKg,
    deltaKg: Number((last.topSetKg - first.topSetKg).toFixed(1)),
    weeks: Math.max(1, Math.round(days / 7)),
  };
}

export type WeeklyWorkoutStats = {
  weekStart: DateKey;
  completed: number;
  target: number;
  volume: number;
};

export function weeklyWorkoutStats(
  workouts: Pick<Workout, 'workout_date' | 'status'>[],
  volumeByWorkoutDate: Map<DateKey, number>,
  weeks: DateKey[],
  target: number,
): WeeklyWorkoutStats[] {
  return weeks.map((weekStart) => {
    const inWeek = workouts.filter(
      (w) => weekStartKey(w.workout_date) === weekStart && w.status === 'completed',
    );
    const volume = inWeek.reduce(
      (acc, w) => acc + (volumeByWorkoutDate.get(w.workout_date) ?? 0),
      0,
    );
    return { weekStart, completed: inWeek.length, target, volume: Math.round(volume) };
  });
}

export function workoutsThisWeek(
  workouts: Pick<Workout, 'workout_date' | 'status'>[],
  today: DateKey,
): number {
  const week = weekStartKey(today);
  return workouts.filter(
    (w) => w.status === 'completed' && weekStartKey(w.workout_date) === week,
  ).length;
}

/**
 * Suggested next load — a gentle nudge, only when the last session was
 * comfortably inside the target rep range at the top end.
 *
 * Returns null far more often than not: the app should not push load.
 */
export function suggestedNextLoad(
  lastSession: { topSetKg: number | null; totalReps: number } | null,
  targetRepsMax: number,
  setCount: number,
): { weightKg: number; reason: string } | null {
  if (!lastSession?.topSetKg) return null;

  // Only suggest more when the whole session cleared the top of the rep range.
  const clearedRange = lastSession.totalReps >= targetRepsMax * setCount;
  if (!clearedRange) return null;

  // Small jumps: 2.5 kg on compound lifts, 1 kg on lighter isolation work.
  const increment = lastSession.topSetKg >= 30 ? 2.5 : 1;
  return {
    weightKg: Number((lastSession.topSetKg + increment).toFixed(1)),
    reason: `You cleared the top of the rep range last time at ${lastSession.topSetKg} kg.`,
  };
}

export const MUSCLE_GROUP_LABELS: Record<Enums<'muscle_group'>, string> = {
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  shoulders: 'Shoulders',
  back: 'Back',
  chest: 'Chest',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  calves: 'Calves',
  core: 'Core',
  full_body: 'Full body',
};

export const WORKOUT_LOCATION_LABELS: Record<Enums<'workout_location'>, string> = {
  office_gym: 'Office gym',
  home: 'Home',
  other: 'Elsewhere',
};

/** Focus areas the user named. Used to order exercise pickers, nothing more. */
export const PRIORITY_MUSCLE_GROUPS: Enums<'muscle_group'>[] = [
  'glutes',
  'quads',
  'hamstrings',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
];
