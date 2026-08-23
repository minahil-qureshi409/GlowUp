import type { Tables } from '@/lib/db/database.types';
import { daysBetween, subDaysKey, type DateKey } from '@/lib/date';

export type WeightEntry = Pick<Tables<'weight_entries'>, 'id' | 'weight_kg' | 'entry_date' | 'note'>;

export type WeightPoint = {
  date: DateKey;
  weightKg: number;
  /** Centred rolling mean. Null until there are enough neighbours to compute it. */
  trendKg: number | null;
};

export type WeightSummary = {
  current: number | null;
  currentDate: DateKey | null;
  starting: number | null;
  startingDate: DateKey | null;
  goal: number | null;
  /** Signed change from the first entry to the latest. */
  totalChangeKg: number | null;
  remainingKg: number | null;
  /** 0–100, clamped. Null when there is no goal or no baseline. */
  percentToGoal: number | null;
  /** Change over the last 7 days of *trend*, not of raw readings. */
  weeklyChangeKg: number | null;
  weeklyAverageKg: number | null;
  entryCount: number;
};

/**
 * Rolling mean over a centred window.
 *
 * Daily weight swings by a kilo on water alone, so the trend line — not the raw
 * reading — is what the app reasons about. A centred window keeps the line
 * aligned with the points instead of lagging them, and the window shrinks at
 * the edges rather than dropping to null, so a short history still draws.
 */
export function withTrend(entries: WeightEntry[], windowDays = 7): WeightPoint[] {
  const sorted = [...entries].sort((a, b) => a.entry_date.localeCompare(b.entry_date));
  const half = Math.floor(windowDays / 2);

  return sorted.map((entry, index) => {
    const from = Math.max(0, index - half);
    const to = Math.min(sorted.length - 1, index + half);

    let sum = 0;
    let count = 0;
    for (let i = from; i <= to; i += 1) {
      const neighbour = sorted[i];
      if (!neighbour) continue;
      // Only average readings that are actually near this one in time — a
      // three-month gap shouldn't be smoothed into a trend.
      if (Math.abs(daysBetween(entry.entry_date, neighbour.entry_date)) > windowDays) continue;
      sum += neighbour.weight_kg;
      count += 1;
    }

    return {
      date: entry.entry_date,
      weightKg: entry.weight_kg,
      trendKg: count >= 2 ? Number((sum / count).toFixed(2)) : null,
    };
  });
}

/** Latest smoothed value, falling back to the raw reading when unsmoothed. */
function latestTrendValue(points: WeightPoint[]): number | null {
  for (let i = points.length - 1; i >= 0; i -= 1) {
    const point = points[i];
    if (!point) continue;
    return point.trendKg ?? point.weightKg;
  }
  return null;
}

/** Smoothed value at or just before `date`, or null if the history is short. */
function trendValueAt(points: WeightPoint[], date: DateKey): number | null {
  let best: WeightPoint | null = null;
  for (const point of points) {
    if (point.date <= date) best = point;
    else break;
  }
  if (!best) return null;
  return best.trendKg ?? best.weightKg;
}

export function summariseWeight(
  entries: WeightEntry[],
  options: { goalKg?: number | null; startKg?: number | null; today: DateKey },
): WeightSummary {
  const sorted = [...entries].sort((a, b) => a.entry_date.localeCompare(b.entry_date));
  const points = withTrend(sorted);
  const first = sorted[0] ?? null;
  const last = sorted[sorted.length - 1] ?? null;

  // The goal's recorded starting value wins over the first log, so the progress
  // bar doesn't silently rebase if an old entry is deleted.
  const starting = options.startKg ?? first?.weight_kg ?? null;
  const current = last?.weight_kg ?? null;
  const goal = options.goalKg ?? null;

  const totalChangeKg =
    current !== null && starting !== null ? Number((current - starting).toFixed(2)) : null;

  const remainingKg = current !== null && goal !== null ? Number((goal - current).toFixed(2)) : null;

  let percentToGoal: number | null = null;
  if (current !== null && goal !== null && starting !== null && goal !== starting) {
    const raw = ((current - starting) / (goal - starting)) * 100;
    percentToGoal = Math.max(0, Math.min(100, Number(raw.toFixed(1))));
  }

  const weekAgo = subDaysKey(options.today, 7);
  const nowTrend = latestTrendValue(points);
  const thenTrend = trendValueAt(points, weekAgo);
  const weeklyChangeKg =
    nowTrend !== null && thenTrend !== null && sorted.length >= 3
      ? Number((nowTrend - thenTrend).toFixed(2))
      : null;

  const lastWeekEntries = sorted.filter((e) => e.entry_date >= weekAgo);
  const weeklyAverageKg =
    lastWeekEntries.length > 0
      ? Number(
          (lastWeekEntries.reduce((acc, e) => acc + e.weight_kg, 0) / lastWeekEntries.length).toFixed(
            2,
          ),
        )
      : null;

  return {
    current,
    currentDate: last?.entry_date ?? null,
    starting,
    startingDate: first?.entry_date ?? null,
    goal,
    totalChangeKg,
    remainingKg,
    percentToGoal,
    weeklyChangeKg,
    weeklyAverageKg,
    entryCount: sorted.length,
  };
}

export type TrendSignal =
  | { kind: 'insufficient-data' }
  | { kind: 'moving'; changeKg: number; weeks: number }
  | { kind: 'flat'; weeks: number }
  | { kind: 'declining'; changeKg: number; weeks: number };

/**
 * Classifies the medium-term trend.
 *
 * Only ever three outcomes and never a judgement: the UI decides what to say.
 * `declining` exists purely so the app can point at a professional when the
 * trend runs opposite to a gain goal — it is not a diagnosis of anything.
 */
export function readTrendSignal(
  entries: WeightEntry[],
  options: { today: DateKey; weeks?: number; goalDirection?: 'gain' | 'lose' | 'maintain' },
): TrendSignal {
  const weeks = options.weeks ?? 3;
  const windowStart = subDaysKey(options.today, weeks * 7);
  const inWindow = entries
    .filter((e) => e.entry_date >= windowStart)
    .sort((a, b) => a.entry_date.localeCompare(b.entry_date));

  // Fewer than four readings over three weeks isn't a trend, it's noise.
  if (inWindow.length < 4) return { kind: 'insufficient-data' };

  const points = withTrend(inWindow);
  const firstPoint = points[0];
  const start = firstPoint ? (firstPoint.trendKg ?? firstPoint.weightKg) : null;
  const end = latestTrendValue(points);
  if (start === null || end === null) return { kind: 'insufficient-data' };

  const changeKg = Number((end - start).toFixed(2));
  const goalDirection = options.goalDirection ?? 'gain';

  // 0.3 kg over three weeks is inside normal measurement noise.
  if (Math.abs(changeKg) < 0.3) return { kind: 'flat', weeks };

  if (goalDirection === 'gain' && changeKg <= -0.8) {
    return { kind: 'declining', changeKg, weeks };
  }
  if (goalDirection === 'lose' && changeKg >= 0.8) {
    return { kind: 'declining', changeKg, weeks };
  }

  return { kind: 'moving', changeKg, weeks };
}

export type Milestone = {
  id: string;
  label: string;
  targetKg: number;
  achievedAt: string | null;
};

export type MilestoneProgress = Milestone & {
  reached: boolean;
  /** True for the nearest unreached milestone above the current weight. */
  isNext: boolean;
};

export function progressMilestones(
  milestones: Milestone[],
  currentKg: number | null,
): MilestoneProgress[] {
  const sorted = [...milestones].sort((a, b) => a.targetKg - b.targetKg);
  let nextAssigned = false;

  return sorted.map((milestone) => {
    // A milestone stays reached once it has been recorded, even if today's
    // reading dips back below it. Progress isn't undone by a fluctuation.
    const reached =
      milestone.achievedAt !== null || (currentKg !== null && currentKg >= milestone.targetKg);
    const isNext = !reached && !nextAssigned;
    if (isNext) nextAssigned = true;
    return { ...milestone, reached, isNext };
  });
}

/** Milestones newly crossed by `weightKg` that have no `achieved_at` yet. */
export function newlyReachedMilestones(milestones: Milestone[], weightKg: number): Milestone[] {
  return milestones.filter((m) => m.achievedAt === null && weightKg >= m.targetKg);
}
