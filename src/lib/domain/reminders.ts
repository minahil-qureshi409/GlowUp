import type { Tables } from '@/lib/db/database.types';
import { currentDayHour, timeToHour, type DateKey, type DayHour } from '@/lib/date';
import { reminderPhrase } from '@/lib/domain/copy';
import type { BusyBlock, DayShape } from '@/lib/domain/planner';
import type { HabitWithStatus } from '@/lib/domain/habits';

/**
 * Reminder eligibility.
 *
 * The decision is pure, so the rules are readable in one place and the delivery
 * mechanism (Notification API now, push later) stays swappable.
 *
 * A reminder is suppressed when any of these hold:
 *   - notifications are off, or the browser has not granted permission
 *   - it is inside quiet hours
 *   - the habit is already logged (done, skipped or modified)
 *   - the user is inside a calendar busy block
 *   - today's reminder budget is spent
 *   - the day is a long one — the budget shrinks rather than the day getting noisier
 *   - this habit was already reminded about today
 */

export type ReminderCandidate = {
  habitId: string;
  habitName: string;
  /** Local hour from which this reminder becomes reasonable. */
  earliestHour: DayHour;
  message: string;
};

export type ReminderDecision =
  | { send: true; candidate: ReminderCandidate }
  | { send: false; reason: ReminderSuppression };

export type ReminderSuppression =
  | 'disabled'
  | 'quiet-hours'
  | 'in-meeting'
  | 'budget-spent'
  | 'already-logged'
  | 'too-early'
  | 'already-reminded'
  | 'nothing-pending';

export type ReminderContext = {
  now: Date;
  timezone: string;
  today: DateKey;
  settings: Pick<
    Tables<'user_settings'>,
    'notifications_enabled' | 'quiet_hours_start' | 'quiet_hours_end' | 'max_daily_reminders'
  >;
  permissionGranted: boolean;
  habits: HabitWithStatus[];
  busy: BusyBlock[];
  dayShape: DayShape;
  /** Habit ids already reminded about today, from local session state. */
  sentToday: ReadonlySet<string>;
};

/** Quiet hours may wrap past midnight, so the comparison flips when they do. */
export function isWithinQuietHours(hour: DayHour, start: DayHour, end: DayHour): boolean {
  if (start === end) return false;
  if (start < end) return hour >= start && hour < end;
  return hour >= start || hour < end;
}

export function isBusyAt(hour: DayHour, busy: BusyBlock[]): boolean {
  return busy.some((block) => hour >= block.startHour && hour < block.endHour);
}

/** The earliest hour a habit's nudge stops feeling premature. */
function earliestHourFor(habit: HabitWithStatus): DayHour {
  const explicit = timeToHour(habit.window_start);
  if (explicit !== null) return explicit;
  switch (habit.preferred_part) {
    case 'morning':
      return 9;
    case 'afternoon':
      return 14;
    case 'evening':
      return 19;
    default:
      return 12;
  }
}

/**
 * A long day earns fewer interruptions, not more. This is the single lever that
 * turns "busy day" into "quieter app".
 */
export function budgetFor(maxDaily: number, dayShape: DayShape): number {
  if (dayShape === 'late') return Math.min(maxDaily, 1);
  if (dayShape === 'busy') return Math.min(maxDaily, 2);
  return maxDaily;
}

export function nextReminder(ctx: ReminderContext): ReminderDecision {
  if (!ctx.settings.notifications_enabled || !ctx.permissionGranted) {
    return { send: false, reason: 'disabled' };
  }

  const hour = currentDayHour(ctx.timezone, ctx.now);
  const quietStart = timeToHour(ctx.settings.quiet_hours_start) ?? 22;
  const quietEnd = timeToHour(ctx.settings.quiet_hours_end) ?? 7.5;

  if (isWithinQuietHours(hour, quietStart, quietEnd)) {
    return { send: false, reason: 'quiet-hours' };
  }

  if (isBusyAt(hour, ctx.busy)) {
    return { send: false, reason: 'in-meeting' };
  }

  const budget = budgetFor(ctx.settings.max_daily_reminders, ctx.dayShape);
  if (ctx.sentToday.size >= budget) {
    return { send: false, reason: 'budget-spent' };
  }

  const pending = ctx.habits
    .filter(
      (habit) =>
        habit.is_active &&
        habit.reminder_enabled &&
        !habit.is_optional &&
        habit.status === null &&
        !ctx.sentToday.has(habit.id),
    )
    .map((habit) => ({ habit, earliestHour: earliestHourFor(habit) }))
    .filter((entry) => hour >= entry.earliestHour)
    // Whatever has been waiting longest goes first.
    .sort((a, b) => a.earliestHour - b.earliestHour);

  const next = pending[0];
  if (!next) return { send: false, reason: 'nothing-pending' };

  return {
    send: true,
    candidate: {
      habitId: next.habit.id,
      habitName: next.habit.name,
      earliestHour: next.earliestHour,
      message: reminderPhrase(next.habit.name),
    },
  };
}

export const SUPPRESSION_LABELS: Record<ReminderSuppression, string> = {
  disabled: 'Reminders are off',
  'quiet-hours': 'Inside your quiet hours',
  'in-meeting': "You're in a calendar block right now",
  'budget-spent': "Today's reminders are done",
  'already-logged': 'Already logged',
  'too-early': 'Not yet',
  'already-reminded': 'Already mentioned today',
  'nothing-pending': 'Nothing pending',
};
