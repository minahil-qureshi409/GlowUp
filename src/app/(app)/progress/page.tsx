import type { Metadata } from 'next';
import Link from 'next/link';
import { CalendarRange, Camera, ChevronRight, LineChart, Scale } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader, SectionHeader } from '@/components/common/page-header';
import { Stat, StatGrid } from '@/components/common/stat';
import { EmptyState } from '@/components/common/empty-state';
import { WeightChart } from '@/components/charts/weight-chart';
import { MilestoneLadder } from '@/components/progress/milestone-ladder';
import { WeightEntryList } from '@/components/progress/weight-entry-list';
import { LogWeightDialog } from '@/components/weight/log-weight-dialog';
import { ConsistencyChart } from '@/components/charts/consistency-chart';

import { requireUser } from '@/server/auth';
import { getUserContext } from '@/services/profile';
import { getWeightEntries, getWeightGoal } from '@/services/weight';
import { getActiveHabits, getCompletionsInRange } from '@/services/habits';
import { getWorkouts } from '@/services/workouts';

import {
  progressMilestones,
  readTrendSignal,
  summariseWeight,
  withTrend,
} from '@/lib/domain/weight';
import { consistencyRate } from '@/lib/domain/habits';
import {
  DOWNWARD_TREND_NOTE,
  EMPTY_STATES,
  NO_COUNTDOWN_NOTE,
  STALL_NOTE,
  weightTrendPhrase,
} from '@/lib/domain/copy';
import { subDaysKey, todayIn, weekDayKeys, weekStartKey } from '@/lib/date';
import { formatDelta, formatWeight } from '@/lib/format';

export const metadata: Metadata = { title: 'Progress' };
export const dynamic = 'force-dynamic';

export default async function ProgressPage() {
  const { supabase, userId } = await requireUser();
  const context = await getUserContext(supabase, userId);

  const today = todayIn(context.profile.timezone);
  const yearAgo = subDaysKey(today, 364);
  const twelveWeeksAgo = subDaysKey(today, 83);

  const [entries, goalContext, habits, completions, workouts] = await Promise.all([
    getWeightEntries(supabase, userId, { from: yearAgo }),
    getWeightGoal(supabase, userId),
    getActiveHabits(supabase, userId),
    getCompletionsInRange(supabase, userId, twelveWeeksAgo, today),
    getWorkouts(supabase, userId, { from: twelveWeeksAgo }),
  ]);

  const summary = summariseWeight(entries, {
    goalKg: goalContext.goal?.target_value ?? null,
    startKg: goalContext.goal?.start_value ?? null,
    today,
  });

  const points = withTrend(entries);
  const milestones = progressMilestones(
    goalContext.milestones.map((m) => ({
      id: m.id,
      label: m.label,
      targetKg: m.target_value,
      achievedAt: m.achieved_at,
    })),
    summary.current,
  );

  const signal = readTrendSignal(entries, { today, weeks: 3, goalDirection: 'gain' });

  const habitIds = habits.filter((h) => !h.is_optional && h.frequency === 'daily').map((h) => h.id);
  const weeklyConsistency = Array.from({ length: 12 }, (_, index) => {
    const weekStart = weekStartKey(subDaysKey(today, (11 - index) * 7));
    const days = weekDayKeys(weekStart);
    const from = days[0] ?? weekStart;
    const rawTo = days[days.length - 1] ?? weekStart;
    return {
      weekStart,
      value: consistencyRate(completions, habitIds, from, rawTo > today ? today : rawTo).rate,
    };
  });

  const workoutsCompleted = workouts.filter((w) => w.status === 'completed').length;

  return (
    <div className="animate-fade-up space-y-6 py-3">
      <PageHeader
        title="Progress"
        description={NO_COUNTDOWN_NOTE}
        action={
          <LogWeightDialog
            today={today}
            lastWeightKg={summary.current}
            trigger={
              <Button variant="brand" size="sm">
                <Scale className="size-4" />
                Log
              </Button>
            }
          />
        }
      />

      {entries.length === 0 ? (
        <EmptyState
          icon={Scale}
          title={EMPTY_STATES.weight.title}
          body={EMPTY_STATES.weight.body}
          action={<LogWeightDialog today={today} lastWeightKg={null} />}
        />
      ) : (
        <>
          <Card>
            <CardContent className="p-5">
              <StatGrid columns={3}>
                <Stat label="Current" value={formatWeight(summary.current)} hint="latest weigh-in" />
                <Stat label="Starting" value={formatWeight(summary.starting)} />
                <Stat label="Goal" value={formatWeight(summary.goal)} />
                <Stat
                  label="Change"
                  value={formatDelta(summary.totalChangeKg)}
                  hint="since you started"
                />
                <Stat label="Remaining" value={formatDelta(summary.remainingKg)} hint="to goal" />
                <Stat
                  label="7-day avg"
                  value={formatWeight(summary.weeklyAverageKg)}
                  hint={`${summary.entryCount} entries`}
                />
              </StatGrid>

              <p className="mt-4 border-t border-border/60 pt-4 text-sm text-muted-foreground">
                {weightTrendPhrase(summary.weeklyChangeKg, 1)}
              </p>
            </CardContent>
          </Card>

          {signal.kind === 'flat' ? (
            <p className="rounded-xl border border-border bg-accent/50 px-4 py-3 text-sm">
              {STALL_NOTE}
            </p>
          ) : null}

          {signal.kind === 'declining' ? (
            <p className="rounded-xl border border-border bg-accent/50 px-4 py-3 text-sm">
              {DOWNWARD_TREND_NOTE}
            </p>
          ) : null}

          <Card>
            <CardContent className="p-4">
              <WeightChart points={points} milestones={milestones} goalKg={summary.goal} />
            </CardContent>
          </Card>

          {milestones.length > 0 ? (
            <section className="space-y-3">
              <SectionHeader title="Milestones" description="Values, not deadlines" />
              <Card>
                <CardContent className="p-4">
                  <MilestoneLadder milestones={milestones} currentKg={summary.current} />
                </CardContent>
              </Card>
            </section>
          ) : null}
        </>
      )}

      <section className="space-y-3">
        <SectionHeader title="Consistency" description="Daily habits logged, by week" />
        <Card>
          <CardContent className="p-4">
            <ConsistencyChart
              title="Habit consistency"
              points={weeklyConsistency}
              seriesSlot={5}
            />
          </CardContent>
        </Card>
      </section>

      <nav aria-label="More progress views">
        <ul className="space-y-2">
          <ProgressLink
            href="/progress/timeline"
            icon={LineChart}
            title="Glow-Up timeline"
            description="Weight, strength, skincare and notes over time"
          />
          <ProgressLink
            href="/progress/review"
            icon={CalendarRange}
            title="Weekly review"
            description={`${workoutsCompleted} sessions logged in the last 12 weeks`}
          />
          <ProgressLink
            href="/progress/photos"
            icon={Camera}
            title="Progress photos"
            description="Private to your account"
          />
        </ul>
      </nav>

      {entries.length > 0 ? (
        <section className="space-y-3">
          <SectionHeader title="All weigh-ins" />
          <WeightEntryList entries={entries.slice().reverse()} today={today} />
        </section>
      ) : null}
    </div>
  );
}

function ProgressLink({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  title: string;
  description: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 transition-colors hover:bg-muted/50"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
          <Icon className="size-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{title}</span>
          <span className="block truncate text-xs text-muted-foreground">{description}</span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </li>
  );
}
