'use client';

import * as React from 'react';

import { useNow } from '@/hooks/use-now';
import type { Tables } from '@/lib/db/database.types';
import type { HabitWithStatus } from '@/lib/domain/habits';
import type { BusyBlock, DayShape } from '@/lib/domain/planner';
import { nextReminder } from '@/lib/domain/reminders';

type ReminderSchedulerProps = {
  settings: Pick<
    Tables<'user_settings'>,
    'notifications_enabled' | 'quiet_hours_start' | 'quiet_hours_end' | 'max_daily_reminders'
  >;
  timezone: string;
  today: string;
  habits: HabitWithStatus[];
  busy: BusyBlock[];
  dayShape: DayShape;
};

const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const STORAGE_KEY = 'glowup:reminders-sent';

/**
 * Reminder delivery.
 *
 * Renders nothing. It re-evaluates `nextReminder` every few minutes and fires
 * at most one notification per pass, with the decision itself living in the
 * pure domain function so the rules stay testable and in one place.
 *
 * What has already been sent is kept in `localStorage`, keyed by date, so a
 * refresh does not restart the day's budget — and so a habit that was already
 * nudged is not nudged again. It resets naturally when the date key changes.
 */
export function ReminderScheduler({
  settings,
  timezone,
  today,
  habits,
  busy,
  dayShape,
}: ReminderSchedulerProps) {
  const now = useNow(CHECK_INTERVAL_MS);
  const [permissionGranted, setPermissionGranted] = React.useState(false);
  const sentRef = React.useRef<Set<string>>(new Set());

  React.useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    setPermissionGranted(Notification.permission === 'granted');
  }, []);

  // Load today's already-sent set; anything from a previous day is discarded.
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { date?: string; ids?: string[] };
      if (parsed.date === today && Array.isArray(parsed.ids)) {
        sentRef.current = new Set(parsed.ids);
      }
    } catch {
      // Storage unavailable or corrupt — start the day fresh.
    }
  }, [today]);

  React.useEffect(() => {
    if (!now || !permissionGranted || !settings.notifications_enabled) return;

    const decision = nextReminder({
      now,
      timezone,
      today,
      settings,
      permissionGranted,
      habits,
      busy,
      dayShape,
      sentToday: sentRef.current,
    });

    if (!decision.send) return;

    try {
      new Notification('GlowUp', {
        body: decision.candidate.message,
        // The tag collapses repeats for the same habit into one notification
        // rather than stacking them.
        tag: `glowup-${decision.candidate.habitId}`,
        icon: '/icon.svg',
        silent: true,
      });

      sentRef.current.add(decision.candidate.habitId);
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ date: today, ids: [...sentRef.current] }),
      );
    } catch {
      // A blocked or unsupported Notification constructor is not worth
      // surfacing — reminders are a convenience, not the product.
    }
  }, [now, permissionGranted, settings, timezone, today, habits, busy, dayShape]);

  return null;
}
