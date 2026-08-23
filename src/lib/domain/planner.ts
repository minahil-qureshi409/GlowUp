import type { Enums, Tables } from '@/lib/db/database.types';
import {
  currentDayHour,
  dayOfWeek,
  greetingFor,
  timeToHour,
  type DateKey,
  type DayHour,
} from '@/lib/date';
import type { HabitWithStatus } from '@/lib/domain/habits';

export type BusyBlock = {
  /** Decimal hours in the user's local timezone. */
  startHour: DayHour;
  endHour: DayHour;
};

export type TimeWindow = {
  startHour: DayHour;
  endHour: DayHour;
};

/**
 * How loaded today looks.
 *
 * Drives *tone and volume*, never permission: a `late` day means fewer
 * suggestions and gentler ones, not a locked feature.
 */
export type DayShape = 'open' | 'normal' | 'busy' | 'late';

export type PlanAction =
  | { kind: 'log-habit'; habitId: string }
  | { kind: 'start-workout'; location: Enums<'workout_location'> }
  | { kind: 'log-weight' }
  | { kind: 'open-skincare'; period: Enums<'skincare_period'> }
  | { kind: 'navigate'; href: string };

export type PlanSuggestion = {
  /** Stable across a day so a dismissal sticks. */
  key: string;
  title: string;
  body?: string;
  tone: 'neutral' | 'positive' | 'gentle';
  action?: PlanAction;
  actionLabel?: string;
};

export type DailyPlan = {
  greeting: string;
  dayShape: DayShape;
  currentHour: DayHour;
  workWindow: TimeWindow | null;
  gym: {
    name: string;
    window: TimeWindow | null;
    availableToday: boolean;
    openNow: boolean;
    /** Minutes until access closes; null when there is no closing time. */
    closesInMinutes: number | null;
  } | null;
  /** Gaps of at least 45 minutes left in the day. */
  openWindows: TimeWindow[];
  suggestions: PlanSuggestion[];
  /** The handful of habits worth surfacing right now. */
  upNext: HabitWithStatus[];
};

const MIN_WORKOUT_WINDOW_HOURS = 0.75;
/** Leave time to actually get there and change before access ends. */
const GYM_ARRIVAL_BUFFER_HOURS = 0.75;

/** Merges overlapping busy blocks so gap maths doesn't double-count. */
export function mergeBusy(blocks: BusyBlock[]): BusyBlock[] {
  const sorted = [...blocks]
    .filter((b) => b.endHour > b.startHour)
    .sort((a, b) => a.startHour - b.startHour);

  const merged: BusyBlock[] = [];
  for (const block of sorted) {
    const last = merged[merged.length - 1];
    if (last && block.startHour <= last.endHour) {
      last.endHour = Math.max(last.endHour, block.endHour);
    } else {
      merged.push({ ...block });
    }
  }
  return merged;
}

/** Free gaps inside `bounds`, ignoring anything shorter than `minHours`. */
export function freeWindows(
  busy: BusyBlock[],
  bounds: TimeWindow,
  minHours = MIN_WORKOUT_WINDOW_HOURS,
): TimeWindow[] {
  const merged = mergeBusy(busy);
  const windows: TimeWindow[] = [];
  let cursor = bounds.startHour;

  for (const block of merged) {
    if (block.endHour <= bounds.startHour) continue;
    if (block.startHour >= bounds.endHour) break;
    const gap = Math.min(block.startHour, bounds.endHour) - cursor;
    if (gap >= minHours) windows.push({ startHour: cursor, endHour: cursor + gap });
    cursor = Math.max(cursor, Math.min(block.endHour, bounds.endHour));
  }

  if (bounds.endHour - cursor >= minHours) {
    windows.push({ startHour: cursor, endHour: bounds.endHour });
  }

  return windows;
}

export function totalBusyHours(blocks: BusyBlock[]): number {
  return mergeBusy(blocks).reduce((acc, b) => acc + (b.endHour - b.startHour), 0);
}

/**
 * Reads the day's shape from whatever is actually known.
 *
 * Calendar data wins when present; otherwise the user's typical hours stand in.
 * Neither is treated as binding — this only decides how much the app says.
 */
export function readDayShape(input: {
  busy: BusyBlock[];
  workWindow: TimeWindow | null;
  isWeekend: boolean;
}): DayShape {
  const busyHours = totalBusyHours(input.busy);
  const merged = mergeBusy(input.busy);
  const lastBlock = merged[merged.length - 1];
  const latestEnd = Math.max(lastBlock?.endHour ?? 0, input.workWindow?.endHour ?? 0);

  if (latestEnd >= 20) return 'late';
  if (busyHours >= 8) return 'late';
  if (busyHours >= 6) return 'busy';
  if (input.isWeekend && busyHours < 2) return 'open';
  if (input.workWindow && input.workWindow.endHour - input.workWindow.startHour >= 8) return 'busy';
  return 'normal';
}

export type PlannerInput = {
  now: Date;
  timezone: string;
  today: DateKey;
  displayName: string | null;
  settings: Pick<
    Tables<'user_settings'>,
    | 'typical_work_start'
    | 'typical_work_end'
    | 'workouts_per_week'
    | 'preferred_workout_days'
    | 'commute_minutes'
    | 'suggestions_enabled'
    | 'weekly_weigh_in_day'
  >;
  gym: Pick<
    Tables<'gym_configs'>,
    'name' | 'access_start' | 'access_end' | 'available_days' | 'is_active'
  > | null;
  busy: BusyBlock[];
  /** True when a calendar is connected — changes how confident the copy is. */
  hasCalendar: boolean;
  habits: HabitWithStatus[];
  workoutsCompletedThisWeek: number;
  workoutLoggedToday: boolean;
  skincareAmDone: boolean;
  skincarePmDone: boolean;
  daysSinceLastWeighIn: number | null;
  dismissedKeys: ReadonlySet<string>;
};

/**
 * Builds the day's view.
 *
 * The contract, in one place: everything returned is an *observation* or an
 * *offer*. Nothing here can be late, overdue, or failed — those states do not
 * exist in the model, so no component can render them.
 */
export function buildDailyPlan(input: PlannerInput): DailyPlan {
  const currentHour = currentDayHour(input.timezone, input.now);
  const dow = dayOfWeek(input.today);
  const isWeekend = dow === 0 || dow === 6;

  const workStart = timeToHour(input.settings.typical_work_start);
  const workEnd = timeToHour(input.settings.typical_work_end);
  const workWindow: TimeWindow | null =
    !isWeekend && workStart !== null && workEnd !== null && workEnd > workStart
      ? { startHour: workStart, endHour: workEnd }
      : null;

  const dayShape = readDayShape({ busy: input.busy, workWindow, isWeekend });

  // ── gym availability ───────────────────────────────────────────────────────
  const gymAccessStart = timeToHour(input.gym?.access_start ?? null);
  const gymAccessEnd = timeToHour(input.gym?.access_end ?? null);
  const gymAvailableToday =
    !!input.gym && input.gym.is_active && (input.gym.available_days ?? []).includes(dow);

  const gymWindow: TimeWindow | null =
    gymAccessStart !== null && gymAccessEnd !== null
      ? { startHour: gymAccessStart, endHour: gymAccessEnd }
      : null;

  const gymOpenNow =
    gymAvailableToday &&
    (gymWindow === null ||
      (currentHour >= gymWindow.startHour && currentHour < gymWindow.endHour));

  const closesInMinutes =
    gymAvailableToday && gymWindow !== null && currentHour < gymWindow.endHour
      ? Math.round((gymWindow.endHour - currentHour) * 60)
      : null;

  // ── remaining open time today ──────────────────────────────────────────────
  const dayBounds: TimeWindow = { startHour: Math.max(currentHour, 6), endHour: 22 };
  const openWindows = freeWindows(input.busy, dayBounds);

  // ── suggestions ────────────────────────────────────────────────────────────
  const suggestions: PlanSuggestion[] = [];
  const workoutsRemaining = Math.max(
    0,
    input.settings.workouts_per_week - input.workoutsCompletedThisWeek,
  );

  if (input.settings.suggestions_enabled) {
    suggestions.push(
      ...workoutSuggestions({
        input,
        currentHour,
        dayShape,
        gymAvailableToday,
        gymWindow,
        gymOpenNow,
        openWindows,
        workoutsRemaining,
      }),
      ...nutritionSuggestions({ input, currentHour, dayShape }),
      ...skincareSuggestions({ input, currentHour }),
      ...weighInSuggestions({ input, dow }),
    );
  }

  const visible = suggestions.filter((s) => !input.dismissedKeys.has(s.key)).slice(0, 3);

  return {
    greeting: greetingFor(currentHour),
    dayShape,
    currentHour,
    workWindow,
    gym: input.gym
      ? {
          name: input.gym.name,
          window: gymWindow,
          availableToday: gymAvailableToday,
          openNow: gymOpenNow,
          closesInMinutes,
        }
      : null,
    openWindows,
    suggestions: visible,
    upNext: pickUpNext(input.habits, currentHour),
  };
}

/**
 * Office-gym suggestions respect the women's-only window as a hard boundary:
 * past `access_end` (minus travel time) the office gym is simply not offered,
 * and home becomes the suggestion instead.
 */
function workoutSuggestions(ctx: {
  input: PlannerInput;
  currentHour: DayHour;
  dayShape: DayShape;
  gymAvailableToday: boolean;
  gymWindow: TimeWindow | null;
  gymOpenNow: boolean;
  openWindows: TimeWindow[];
  workoutsRemaining: number;
}): PlanSuggestion[] {
  const { input, currentHour, dayShape, gymWindow, gymOpenNow, workoutsRemaining } = ctx;

  if (input.workoutLoggedToday) {
    return [
      {
        key: 'workout-done-today',
        title: 'Workout logged today ✨',
        body:
          workoutsRemaining > 0
            ? `${workoutsRemaining} more this week whenever it suits.`
            : 'That completes your week. Nice.',
        tone: 'positive',
      },
    ];
  }

  if (workoutsRemaining === 0) return [];

  const gymUsable =
    ctx.gymAvailableToday &&
    gymOpenNow &&
    gymWindow !== null &&
    gymWindow.endHour - currentHour >= MIN_WORKOUT_WINDOW_HOURS + GYM_ARRIVAL_BUFFER_HOURS;

  if (gymUsable && gymWindow) {
    const minutesLeft = Math.round((gymWindow.endHour - currentHour) * 60);
    return [
      {
        key: 'workout-office-gym',
        title: 'Today looks like a good day for an office workout',
        body: `${input.gym?.name ?? 'The gym'} is open to you for about ${formatMinutes(minutesLeft)} more.`,
        tone: 'positive',
        action: { kind: 'start-workout', location: 'office_gym' },
        actionLabel: 'Start a session',
      },
    ];
  }

  if (dayShape === 'late') {
    return [
      {
        key: 'workout-late-day',
        title: 'Busy day — a home session may fit better',
        body: 'Or move it to another day this week. Either is fine.',
        tone: 'gentle',
        action: { kind: 'start-workout', location: 'home' },
        actionLabel: 'Log a home workout',
      },
    ];
  }

  // Gym is shut for the day (or wasn't an option) but there is still time.
  const eveningWindow = ctx.openWindows.find(
    (w) => w.endHour - Math.max(w.startHour, currentHour) >= MIN_WORKOUT_WINDOW_HOURS,
  );

  if (eveningWindow) {
    const gymClosedNote =
      ctx.gymAvailableToday && gymWindow && currentHour >= gymWindow.endHour - GYM_ARRIVAL_BUFFER_HOURS
        ? 'Office gym hours have passed for today, so home is the easier option.'
        : 'There is a gap in your day that would fit a session.';
    return [
      {
        key: 'workout-home-window',
        title: `${workoutsRemaining} ${workoutsRemaining === 1 ? 'workout' : 'workouts'} left this week`,
        body: gymClosedNote,
        tone: 'neutral',
        action: { kind: 'start-workout', location: 'home' },
        actionLabel: 'Start at home',
      },
    ];
  }

  return [];
}

function nutritionSuggestions(ctx: {
  input: PlannerInput;
  currentHour: DayHour;
  dayShape: DayShape;
}): PlanSuggestion[] {
  const { input, currentHour, dayShape } = ctx;

  const pending = input.habits.filter(
    (h) => h.category === 'nutrition' && h.is_active && h.status === null && !h.is_optional,
  );
  if (pending.length === 0) return [];

  // On a heavy day, offer one practical adjustment rather than a list.
  if (dayShape === 'late' && currentHour >= 12) {
    return [
      {
        key: 'nutrition-busy-day',
        title: 'Long day ahead',
        body: 'Keeping a snack with you helps. The evening shake works fine once you are home.',
        tone: 'gentle',
      },
    ];
  }

  // Otherwise nudge the single most relevant item for the current part of day.
  const partNow: Enums<'day_part'> =
    currentHour < 12 ? 'morning' : currentHour < 17 ? 'afternoon' : 'evening';
  const match =
    pending.find((h) => h.preferred_part === partNow) ??
    pending.find((h) => h.preferred_part === 'anytime');

  if (!match) return [];

  return [
    {
      key: `nutrition-pending-${match.id}`,
      title: `${match.name} isn't logged yet`,
      body: 'Whenever it fits.',
      tone: 'neutral',
      action: { kind: 'log-habit', habitId: match.id },
      actionLabel: 'Mark done',
    },
  ];
}

function skincareSuggestions(ctx: {
  input: PlannerInput;
  currentHour: DayHour;
}): PlanSuggestion[] {
  const { input, currentHour } = ctx;

  if (currentHour >= 20 && !input.skincarePmDone) {
    return [
      {
        key: 'skincare-pm',
        title: 'Evening skincare before bed',
        body: 'Moisturiser is optional — skip it if your skin prefers that.',
        tone: 'neutral',
        action: { kind: 'open-skincare', period: 'pm' },
        actionLabel: 'Open routine',
      },
    ];
  }

  if (currentHour < 11 && !input.skincareAmDone) {
    return [
      {
        key: 'skincare-am',
        title: 'Morning routine is still open',
        tone: 'neutral',
        action: { kind: 'open-skincare', period: 'am' },
        actionLabel: 'Open routine',
      },
    ];
  }

  return [];
}

function weighInSuggestions(ctx: { input: PlannerInput; dow: number }): PlanSuggestion[] {
  const { input, dow } = ctx;
  const days = input.daysSinceLastWeighIn;

  if (days === null) {
    return [
      {
        key: 'weigh-in-first',
        title: 'Log your first weigh-in',
        body: 'One reading a week is enough to see a trend.',
        tone: 'neutral',
        action: { kind: 'log-weight' },
        actionLabel: 'Log weight',
      },
    ];
  }

  const onWeighInDay = dow === input.settings.weekly_weigh_in_day;
  if (days >= 7 || (onWeighInDay && days >= 5)) {
    return [
      {
        key: 'weigh-in-available',
        title: 'Weekly weigh-in is available',
        body: 'No rush — whenever you get a moment.',
        tone: 'neutral',
        action: { kind: 'log-weight' },
        actionLabel: 'Log weight',
      },
    ];
  }

  return [];
}

/**
 * The two or three habits worth showing at the top of the day.
 *
 * Anchored on the current part of the day, but never hides anything: this only
 * reorders what the full list already contains.
 */
function pickUpNext(habits: HabitWithStatus[], currentHour: DayHour): HabitWithStatus[] {
  const partNow: Enums<'day_part'> =
    currentHour < 12 ? 'morning' : currentHour < 17 ? 'afternoon' : 'evening';
  const order: Record<Enums<'day_part'>, number> = {
    morning: 0,
    afternoon: 1,
    evening: 2,
    anytime: 3,
  };

  return habits
    .filter((h) => h.is_active && h.status === null)
    .sort((a, b) => {
      const aCurrent = a.preferred_part === partNow ? 0 : 1;
      const bCurrent = b.preferred_part === partNow ? 0 : 1;
      if (aCurrent !== bCurrent) return aCurrent - bCurrent;
      return order[a.preferred_part] - order[b.preferred_part];
    })
    .slice(0, 3);
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} minutes`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (rest === 0) return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  return `${hours}h ${rest}m`;
}

export const DAY_SHAPE_LABELS: Record<DayShape, string> = {
  open: 'An open day',
  normal: 'A normal day',
  busy: 'A full day',
  late: 'A long day',
};
