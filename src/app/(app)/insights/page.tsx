import type { Metadata } from 'next';
import { Lightbulb } from 'lucide-react';

import { EmptyState } from '@/components/common/empty-state';
import { InsightPanel, type InsightPanelProps } from '@/components/glow/insight-panel';

import { requireUser } from '@/server/auth';
import { getUserContext } from '@/services/profile';
import { getActiveHabits, getCompletionsInRange, getDismissedSuggestions } from '@/services/habits';
import { getWeightEntries } from '@/services/weight';
import { getWorkouts } from '@/services/workouts';
import { getEntriesInRange } from '@/services/skincare';
import { getDailyMetricsInRange } from '@/services/daily';

import { dailyPercentMap, weekdayProfile } from '@/lib/domain/habits';
import { buildInsights } from '@/lib/domain/insights';
import { SLEEP_TARGET_HOURS } from '@/lib/domain/glow';
import { subDaysKey, todayIn, weekStartKey } from '@/lib/date';

export const metadata: Metadata = { title: 'Insights' };
export const dynamic = 'force-dynamic';

export default async function InsightsPage() {
  const { supabase, userId } = await requireUser();
  const context = await getUserContext(supabase, userId);

  const today = todayIn(context.profile.timezone);
  const from = subDaysKey(today, 29);

  const [habits, completions, weightEntries, workouts, skincare, metrics, dismissed] =
    await Promise.all([
      getActiveHabits(supabase, userId),
      getCompletionsInRange(supabase, userId, from, today),
      getWeightEntries(supabase, userId, { from: subDaysKey(today, 120) }),
      getWorkouts(supabase, userId, { from }),
      getEntriesInRange(supabase, userId, from, today),
      getDailyMetricsInRange(supabase, userId, from, today),
      getDismissedSuggestions(supabase, userId, today),
    ]);

  const percentMap = dailyPercentMap(habits, completions, from, today);
  const profile = weekdayProfile(percentMap);

  const panels: InsightPanelProps[] = [];

  // ── consistency by weekday ─────────────────────────────────────────────────
  // Only worth saying when the two halves of the week actually differ. A
  // 3-point gap dressed up as a finding is how a tracker loses your trust.
  const measured = profile.filter((day) => day.days > 0);
  if (measured.length >= 5) {
    const weekdays = profile.slice(0, 5).filter((d) => d.days > 0);
    const weekend = profile.slice(5).filter((d) => d.days > 0);
    const weekdayMean = mean(weekdays.map((d) => d.percent));
    const weekendMean = mean(weekend.map((d) => d.percent));
    const gap = Math.round(Math.abs(weekdayMean - weekendMean));

    panels.push({
      tag: 'Consistency',
      headline:
        gap < 12
          ? 'Your week is remarkably even.'
          : weekdayMean > weekendMean
            ? "You're most consistent on weekdays."
            : 'Weekends are when you actually get to it.',
      body:
        gap < 12
          ? `Weekdays average ${Math.round(weekdayMean)}% and weekends ${Math.round(weekendMean)}%. Nothing here needs fixing.`
          : `Weekdays average ${Math.round(weekdayMean)}%, weekends ${Math.round(weekendMean)}% — a ${gap}-point gap. Worth planning something gentler for the quieter half.`,
      bars: profile.map((day) => ({ label: day.label, percent: day.percent })),
      tint: 'bg-sage-soft',
      barClass: 'bg-sage',
    });
  }

  // ── movement across the last four weeks ────────────────────────────────────
  const weeks = lastWeekStarts(today, 4);
  const perWeek = weeks.map((weekStart) => ({
    label: weekStart.slice(8),
    count: workouts.filter(
      (w) => w.status === 'completed' && weekStartKey(w.workout_date) === weekStart,
    ).length,
  }));
  const totalWorkouts = perWeek.reduce((sum, w) => sum + w.count, 0);

  if (totalWorkouts > 0) {
    const target = Math.max(1, context.settings.workouts_per_week);
    const newest = perWeek[perWeek.length - 1]?.count ?? 0;
    const oldest = perWeek[0]?.count ?? 0;
    panels.push({
      tag: 'Movement',
      headline:
        newest >= oldest
          ? 'Your movement is holding or climbing.'
          : 'Movement has eased off lately.',
      body: `${totalWorkouts} sessions over four weeks, against a target of ${target} a week. The bars are one week each, oldest on the left.`,
      bars: perWeek.map((w) => ({
        label: w.label,
        percent: Math.min(100, Math.round((w.count / target) * 100)),
      })),
      tint: 'bg-primary-soft',
      barClass: 'bg-primary-fill',
    });
  }

  // ── sleep ──────────────────────────────────────────────────────────────────
  const slept = metrics.filter((m) => m.sleep_hours !== null);
  if (slept.length >= 5) {
    const avg = mean(slept.map((m) => Number(m.sleep_hours)));
    const short = slept.filter((m) => Number(m.sleep_hours) < 6.5).length;
    panels.push({
      tag: 'Sleep',
      headline:
        avg >= SLEEP_TARGET_HOURS - 0.5
          ? "You're getting the sleep you need."
          : 'Sleep is running short of your target.',
      body: `Averaging ${avg.toFixed(1)} hours across ${slept.length} logged nights, against a target of ${SLEEP_TARGET_HOURS}. ${short} of those nights came in under 6½ hours.`,
      bars: slept.slice(-7).map((m) => ({
        label: m.metric_date.slice(8),
        percent: Math.min(100, Math.round((Number(m.sleep_hours) / SLEEP_TARGET_HOURS) * 100)),
      })),
      tint: 'bg-lav-soft',
      barClass: 'bg-lav',
    });
  }

  // ── hydration ──────────────────────────────────────────────────────────────
  const hydrated = metrics.filter((m) => m.water_glasses > 0);
  if (hydrated.length >= 5) {
    const avg = mean(hydrated.map((m) => m.water_glasses));
    panels.push({
      tag: 'Hydration',
      headline: avg >= 6 ? 'Hydration has become a habit.' : 'Water is the easiest one to move.',
      body: `Averaging ${avg.toFixed(1)} glasses on the ${hydrated.length} days you logged any. Two more a day is usually the difference.`,
      bars: hydrated.slice(-7).map((m) => ({
        label: m.metric_date.slice(8),
        percent: Math.min(100, Math.round((m.water_glasses / 8) * 100)),
      })),
      tint: 'bg-accent',
      barClass: 'bg-amber',
    });
  }

  // ── skincare ───────────────────────────────────────────────────────────────
  const amDays = new Set(
    skincare.filter((e) => e.period === 'am' && e.status === 'completed').map((e) => e.log_date),
  ).size;
  const pmDays = new Set(
    skincare.filter((e) => e.period === 'pm' && e.status === 'completed').map((e) => e.log_date),
  ).size;
  if (amDays + pmDays >= 6) {
    panels.push({
      tag: 'Skincare',
      headline:
        amDays > pmDays * 1.4
          ? 'Mornings are your reliable ritual.'
          : pmDays > amDays * 1.4
            ? 'Evenings are where your routine lives.'
            : 'Both routines are keeping pace.',
      body: `${amDays} morning and ${pmDays} evening routines completed in the last 30 days.`,
      tint: 'bg-mauve-soft',
      barClass: 'bg-mauve',
    });
  }

  // The existing suggestion engine, shown as reading rather than as prompts.
  const engineInsights = buildInsights({
    today,
    habits,
    completions,
    weightEntries,
    skincareEntries: skincare,
    workouts,
    workoutsPerWeek: context.settings.workouts_per_week,
    preferredWorkoutDays: context.settings.preferred_workout_days,
    dismissedKeys: dismissed,
  });

  for (const insight of engineInsights.slice(0, 3)) {
    panels.push({
      tag: 'Pattern',
      headline: insight.title,
      body: insight.body,
      tint: 'bg-accent',
    });
  }

  return (
    <div className="animate-fade-up space-y-4 py-4">
      <header className="px-1">
        <h1 className="font-display text-display-md">What we&rsquo;re noticing</h1>
        <p className="mt-1.5 text-[14.5px] text-muted-foreground">
          Patterns from your last 30 days. Observations, not instructions.
        </p>
      </header>

      {panels.length === 0 ? (
        <EmptyState
          icon={Lightbulb}
          title="Nothing to report yet"
          body="Insights need a couple of weeks of logs before they say anything worth reading. Keep going and this fills in on its own."
        />
      ) : (
        <div className="space-y-3">
          {panels.map((panel) => (
            <InsightPanel key={`${panel.tag}-${panel.headline}`} {...panel} />
          ))}
        </div>
      )}
    </div>
  );
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** The Monday of each of the last `count` weeks, oldest first. */
function lastWeekStarts(today: string, count: number): string[] {
  const thisWeek = weekStartKey(today);
  return Array.from({ length: count }, (_, i) =>
    weekStartKey(subDaysKey(thisWeek, (count - 1 - i) * 7)),
  );
}
