import type { Metadata } from 'next';
import Link from 'next/link';
import { Scale } from 'lucide-react';

import { EmptyState } from '@/components/common/empty-state';
import { WeightChart } from '@/components/charts/weight-chart';
import { WeightEntryList } from '@/components/progress/weight-entry-list';
import { LogWeightDialog } from '@/components/weight/log-weight-dialog';
import { RangeTabs, rangeFromParam, RANGE_DAYS } from '@/components/glow/range-tabs';

import { requireUser } from '@/server/auth';
import { getUserContext } from '@/services/profile';
import { getWeightEntries, getWeightGoal } from '@/services/weight';

import { progressMilestones, summariseWeight, withTrend } from '@/lib/domain/weight';
import { EMPTY_STATES, NO_COUNTDOWN_NOTE, weightTrendPhrase } from '@/lib/domain/copy';
import { subDaysKey, todayIn } from '@/lib/date';
import { formatDelta, formatWeight, formatWeightNumber } from '@/lib/format';

export const metadata: Metadata = { title: 'Weight' };
export const dynamic = 'force-dynamic';

export default async function WeightPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; log?: string }>;
}) {
  const { range: rangeParam, log } = await searchParams;
  const range = rangeFromParam(rangeParam);

  const { supabase, userId } = await requireUser();
  const context = await getUserContext(supabase, userId);

  const today = todayIn(context.profile.timezone);
  const from = subDaysKey(today, RANGE_DAYS[range]);

  const [entries, goalContext] = await Promise.all([
    getWeightEntries(supabase, userId, { from }),
    getWeightGoal(supabase, userId),
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

  const logTrigger = (
    <button
      type="button"
      className="w-full rounded-2xl bg-primary px-5 py-4 text-[15.5px] font-semibold text-primary-foreground transition-transform active:scale-[0.985] motion-reduce:active:scale-100"
    >
      Log today&rsquo;s weight
    </button>
  );

  return (
    <div className="animate-fade-up space-y-4 py-4">
      <header className="px-1">
        <p className="eyebrow">Weight</p>
        <div className="mt-2 flex items-end gap-3">
          <span className="tabular text-[56px] font-semibold leading-[0.9] tracking-[-0.04em]">
            {formatWeightNumber(summary.current)}
          </span>
          <span className="pb-1.5 text-[19px] font-medium text-subtle">kg</span>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          {summary.weeklyChangeKg !== null ? (
            <span className="tabular font-semibold text-sage-ink">
              {formatDelta(summary.weeklyChangeKg)} this week
            </span>
          ) : (
            <span>Not enough entries for a weekly trend yet</span>
          )}
          <span className="ml-2">{weightTrendPhrase(summary.weeklyChangeKg, 1)}</span>
        </p>
      </header>

      {entries.length === 0 ? (
        <EmptyState
          icon={Scale}
          title={EMPTY_STATES.weight.title}
          body={EMPTY_STATES.weight.body}
          action={<LogWeightDialog today={today} lastWeightKg={null} />}
        />
      ) : (
        <>
          <section aria-labelledby="journey-heading" className="surface-card p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 id="journey-heading" className="text-[15.5px] font-semibold">
                Weight journey
              </h2>
              <RangeTabs basePath="/weight" active={range} />
            </div>

            <WeightChart points={points} milestones={milestones} goalKg={summary.goal} />
          </section>

          <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-3xl border border-border/70 bg-border">
            {[
              { k: 'Start', v: formatWeight(summary.starting) },
              { k: 'Now', v: formatWeight(summary.current) },
              { k: 'Goal', v: formatWeight(summary.goal) },
            ].map((stat) => (
              <div key={stat.k} className="bg-card px-4 py-4">
                <dt className="eyebrow !tracking-[0.12em] text-[10.5px]">{stat.k}</dt>
                <dd className="tabular mt-1.5 text-[19px] font-semibold tracking-tight">
                  {stat.v}
                </dd>
              </div>
            ))}
          </dl>

          <LogWeightDialog
            today={today}
            lastWeightKg={summary.current}
            trigger={logTrigger}
            defaultOpen={log === '1'}
          />

          <section aria-labelledby="entries-heading" className="surface-card p-5">
            <h2 id="entries-heading" className="mb-3 text-[15.5px] font-semibold">
              Recent entries
            </h2>
            <WeightEntryList entries={[...entries].reverse()} today={today} />
          </section>

          <p className="px-1 text-xs leading-relaxed text-subtle">{NO_COUNTDOWN_NOTE}</p>

          <p className="px-1 text-xs text-subtle">
            Looking for photos, milestones and consistency?{' '}
            <Link href="/progress" className="font-medium text-primary underline-offset-4 hover:underline">
              Open Progress
            </Link>
            .
          </p>
        </>
      )}
    </div>
  );
}
