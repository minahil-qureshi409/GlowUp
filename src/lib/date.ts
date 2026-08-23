import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfWeek,
  format,
  parseISO,
  startOfWeek,
  subDays,
} from 'date-fns';
import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz';

import type { Enums } from '@/lib/db/database.types';

/**
 * Time handling rules for the whole app:
 *
 *  - "Now" is always read from the system clock. Nothing is ever hard-coded.
 *  - A *day* is a calendar date in the user's own timezone, stored as
 *    `yyyy-MM-dd`. Two users in different zones logging "today" get different
 *    strings, which is the point.
 *  - Anything with an instant attached (a busy block, a completion timestamp)
 *    stays a `timestamptz` and is only converted for display.
 */

/** `yyyy-MM-dd` — the shape every `date` column and every date key uses. */
export type DateKey = string;

/** Hours since midnight as a float, e.g. 14.5 for 14:30. Handy for windows. */
export type DayHour = number;

export const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/** The browser's IANA timezone, or UTC where the API is unavailable. */
export function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Today's calendar date in `timezone`. */
export function todayIn(timezone: string, now: Date = new Date()): DateKey {
  return formatInTimeZone(now, timezone, 'yyyy-MM-dd');
}

/**
 * The single source of truth for "what day is it for this user".
 *
 * Every server component, server action and query that needs today, this week
 * or a day key goes through this or `toUserDate`. Nothing calls a bare
 * `new Date()` and slices it — that reads the *server's* day, which is how a
 * user in Karachi logging at 00:05 ended up with yesterday's weigh-in.
 */
export function getUserToday(timezone: string, now: Date = new Date()): DateKey {
  return todayIn(timezone, now);
}

/** The calendar date an instant falls on, in the user's timezone. */
export function toUserDate(instant: Date | string | number, timezone: string): DateKey {
  const date = instant instanceof Date ? instant : new Date(instant);
  return formatInTimeZone(date, timezone, 'yyyy-MM-dd');
}

/** Start of the user's current week (Monday), as a date key. */
export function getUserWeekStart(timezone: string, now: Date = new Date()): DateKey {
  return weekStartKey(getUserToday(timezone, now));
}

/** Wall-clock `Date` in `timezone` — use only to read hours/minutes/weekday. */
export function zonedNow(timezone: string, now: Date = new Date()): Date {
  return toZonedTime(now, timezone);
}

/** Decimal hours of the current wall-clock time in `timezone`. */
export function currentDayHour(timezone: string, now: Date = new Date()): DayHour {
  const zoned = zonedNow(timezone, now);
  return zoned.getHours() + zoned.getMinutes() / 60;
}

/** Turns a `HH:mm[:ss]` Postgres `time` into decimal hours. */
export function timeToHour(time: string | null | undefined): DayHour | null {
  if (!time) return null;
  const parts = time.split(':');
  const h = Number(parts[0]);
  const m = Number(parts[1] ?? 0);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h + m / 60;
}

/** Decimal hours back to `HH:mm` for storing in a `time` column. */
export function hourToTime(hour: DayHour): string {
  const clamped = Math.max(0, Math.min(23.9833, hour));
  const h = Math.floor(clamped);
  const m = Math.round((clamped - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Instant for a wall-clock time on a given date in `timezone`. */
export function zonedDateTime(date: DateKey, time: string, timezone: string): Date {
  const hhmm = time.length === 5 ? `${time}:00` : time;
  return fromZonedTime(`${date}T${hhmm}`, timezone);
}

export function parseDateKey(date: DateKey): Date {
  return parseISO(`${date}T00:00:00`);
}

export function toDateKey(date: Date): DateKey {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDaysKey(date: DateKey, days: number): DateKey {
  return toDateKey(addDays(parseDateKey(date), days));
}

export function subDaysKey(date: DateKey, days: number): DateKey {
  return toDateKey(subDays(parseDateKey(date), days));
}

export function daysBetween(from: DateKey, to: DateKey): number {
  return differenceInCalendarDays(parseDateKey(to), parseDateKey(from));
}

/** Weeks start on Monday: the review cadence and the work week line up. */
export function weekStartKey(date: DateKey): DateKey {
  return toDateKey(startOfWeek(parseDateKey(date), { weekStartsOn: 1 }));
}

export function weekEndKey(date: DateKey): DateKey {
  return toDateKey(endOfWeek(parseDateKey(date), { weekStartsOn: 1 }));
}

export function weekDayKeys(weekStart: DateKey): DateKey[] {
  return eachDayOfInterval({
    start: parseDateKey(weekStart),
    end: addDays(parseDateKey(weekStart), 6),
  }).map(toDateKey);
}

/** Inclusive list of date keys, oldest first. */
export function dateRangeKeys(from: DateKey, to: DateKey): DateKey[] {
  const start = parseDateKey(from);
  const end = parseDateKey(to);
  if (end < start) return [];
  return eachDayOfInterval({ start, end }).map(toDateKey);
}

/** 0 = Sunday … 6 = Saturday, matching Postgres `extract(dow)`. */
export function dayOfWeek(date: DateKey): number {
  return parseDateKey(date).getDay();
}

// ── display ──────────────────────────────────────────────────────────────────

export function formatTimeOfDay(
  value: Date | string,
  timeFormat: Enums<'time_format'>,
  timezone: string,
): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return formatInTimeZone(date, timezone, timeFormat === '24h' ? 'HH:mm' : 'h:mm a');
}

/** Formats a bare `HH:mm` Postgres time — no date, no timezone conversion. */
export function formatClockTime(time: string | null, timeFormat: Enums<'time_format'>): string {
  const hour = timeToHour(time);
  if (hour === null) return '—';
  const h24 = Math.floor(hour);
  const m = Math.round((hour - h24) * 60);
  if (timeFormat === '24h') {
    return `${String(h24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  const suffix = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return m === 0 ? `${h12} ${suffix}` : `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

/**
 * Formats a `yyyy-MM-dd` key exactly as written — no timezone conversion.
 *
 * `parseDateKey` builds the date at *local* midnight, so it must be formatted
 * with local getters too. Formatting it in UTC (as this used to) subtracts the
 * host's offset and renders the previous day for anything east of Greenwich:
 * that single mismatch is what made the week strip's `aria-label`s, the
 * calendar detail panel and every "latest weigh-in" line read a day early.
 */
export function formatDateKey(date: DateKey, pattern = 'EEE d MMM'): string {
  return format(parseDateKey(date), pattern);
}

export function formatDateLong(date: DateKey): string {
  return formatDateKey(date, 'EEEE, d MMMM yyyy');
}

/** "Today" / "Yesterday" / a short date, relative to the user's today. */
export function formatRelativeDay(date: DateKey, today: DateKey): string {
  const diff = daysBetween(date, today);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff === -1) return 'Tomorrow';
  if (diff > 1 && diff < 7) return `${diff} days ago`;
  return formatDateKey(date, 'd MMM yyyy');
}

/** Greeting keyed off the user's local hour. */
export function greetingFor(hour: DayHour): string {
  if (hour < 5) return 'Still up';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  if (hour < 22) return 'Good evening';
  return 'Winding down';
}

export function dayPartFor(hour: DayHour): Enums<'day_part'> {
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}
