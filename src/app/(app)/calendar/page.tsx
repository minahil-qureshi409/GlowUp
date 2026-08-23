import type { Metadata } from 'next';

import { PageHeader, SectionHeader } from '@/components/common/page-header';
import AppleConnectButton from '@/components/calendar/AppleConnectButton';
import { ConnectionCard } from '@/components/calendar/connection-card';
import { WeekView, type WeekDayData } from '@/components/calendar/week-view';

import { requireUser } from '@/server/auth';
import { getUserContext } from '@/services/profile';
import { getBusyBlocksInRange, getConnections } from '@/services/calendar';
import { listProviders } from '@/lib/calendar/registry';
import { getActiveHabits, getCompletionsInRange } from '@/services/habits';
import { getWorkouts } from '@/services/workouts';
import { getEntriesInRange } from '@/services/skincare';
import { getWeightEntries } from '@/services/weight';

import { dailyPercentMap } from '@/lib/domain/habits';
import { timeToHour, todayIn, weekDayKeys, weekEndKey, weekStartKey } from '@/lib/date';

export const metadata: Metadata = { title: 'Calendar' };
export const dynamic = 'force-dynamic';

/**
 * Every way a connection attempt can end, said plainly.
 *
 * A cancelled consent screen is not a failure and must not be dressed as one;
 * a state mismatch is worth naming because it is usually a stale tab, not an
 * attack; and a deployment with no credentials should say so rather than
 * offering a button that cannot work.
 */
const CONNECT_ERRORS: Record<string, string> = {
  not_configured:
    'This deployment has no credentials configured for that calendar provider yet.',
  unknown_provider: 'That calendar provider is not available.',
  invalid_state:
    'That connection attempt could not be verified — it may have been started in another tab. Please try again.',
  expired_state: 'That connection attempt took too long and has expired. Please try again.',
  missing_code: 'The provider did not send anything back. Please try again.',
  access_denied: 'No problem — nothing was connected.',
  exchange_failed: 'The connection did not complete. Please try again.',
  default: 'The connection did not complete. Please try again.',
};

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const params = await searchParams;
  const { supabase, userId } = await requireUser();
  const context = await getUserContext(supabase, userId);

  const timezone = context.profile.timezone;
  const today = todayIn(timezone);
  const weekStart = weekStartKey(today);
  const weekEnd = weekEndKey(today);

  const [connections, busyByDay, habits, completions, workouts, skincare, weights] =
    await Promise.all([
      getConnections(supabase, userId),
      getBusyBlocksInRange(supabase, userId, weekStart, weekEnd, timezone),
      getActiveHabits(supabase, userId),
      getCompletionsInRange(supabase, userId, weekStart, weekEnd),
      getWorkouts(supabase, userId, { from: weekStart, to: weekEnd }),
      getEntriesInRange(supabase, userId, weekStart, weekEnd),
      getWeightEntries(supabase, userId, { from: weekStart }),
    ]);

  const providers = listProviders();
  const connectionByProvider = new Map(connections.map((c) => [c.provider, c]));

  const percentMap = dailyPercentMap(habits, completions, weekStart, weekEnd);
  const weightByDate = new Map(weights.map((entry) => [entry.entry_date, entry.weight_kg]));

  const days: WeekDayData[] = weekDayKeys(weekStart).map((date) => {
    const workout = workouts.find(
      (item) => item.workout_date === date && item.status === 'completed',
    );
    return {
      date,
      busy: busyByDay.get(date) ?? [],
      workoutCompleted: Boolean(workout),
      workoutName: workout?.name ?? null,
      skincareAm: skincare.some(
        (entry) => entry.log_date === date && entry.period === 'am' && entry.status === 'completed',
      ),
      skincarePm: skincare.some(
        (entry) => entry.log_date === date && entry.period === 'pm' && entry.status === 'completed',
      ),
      weighIn: weightByDate.get(date) ?? null,
      habitPercent: percentMap.get(date) ?? 0,
    };
  });

  const workStart = timeToHour(context.settings.typical_work_start);
  const workEnd = timeToHour(context.settings.typical_work_end);
  const gymStart = timeToHour(context.gym?.access_start ?? null);
  const gymEnd = timeToHour(context.gym?.access_end ?? null);

  return (
    <div className="animate-fade-up space-y-6 py-3">
      <PageHeader
        title="Calendar"
        description="Optional. Connecting one lets suggestions work around your real day."
      />

      {params.connected ? (
        <p className="rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm">
          Calendar connected. Suggestions will now take your busy times into account.
        </p>
      ) : null}

      {params.error ? (
        <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {CONNECT_ERRORS[params.error] ?? CONNECT_ERRORS['default']}
        </p>
      ) : null}

      <section className="space-y-3">
        <SectionHeader title="This week" description="What actually happened, day by day" />
        <WeekView
          weekStart={weekStart}
          today={today}
          days={days}
          workWindow={
            workStart !== null && workEnd !== null
              ? { startHour: workStart, endHour: workEnd }
              : null
          }
          gymWindow={
            gymStart !== null && gymEnd !== null ? { startHour: gymStart, endHour: gymEnd } : null
          }
          gymDays={context.gym?.available_days ?? []}
          timeFormat={context.profile.time_format}
        />
      </section>

      <section className="space-y-3">
        <SectionHeader
          title="Connections"
          description="GlowUp only ever asks for busy times."
        />
        <div className="space-y-3">
          {providers.map((provider) => (
            <ConnectionCard
              key={provider.id}
              provider={provider}
              connection={connectionByProvider.get(provider.id) ?? null}
              timezone={timezone}
            />
          ))}
          <AppleConnectButton />
        </div>
      </section>
    </div>
  );
}
