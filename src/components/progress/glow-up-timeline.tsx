'use client';

import * as React from 'react';
import Image from 'next/image';
import { Dumbbell, Flag, Salad, Scale, Sparkles, StickyNote } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { EmptyState } from '@/components/common/empty-state';
import { AddMilestoneDialog } from '@/components/progress/add-milestone-dialog';

import type { Tables } from '@/lib/db/database.types';
import type { WeightEntry } from '@/services/weight';
import type { ProgressPhotoWithUrl, TimelineMilestone, WeeklyReview } from '@/services/progress';
import type { SetWithContext } from '@/lib/domain/workout';
import type { Habit, HabitCompletion } from '@/lib/domain/habits';

import { consistencyRate } from '@/lib/domain/habits';
import { periodConsistency } from '@/lib/domain/skincare';
import { strengthChange } from '@/lib/domain/workout';
import { summariseWeight } from '@/lib/domain/weight';
import { EMPTY_STATES } from '@/lib/domain/copy';
import { formatDateKey, subDaysKey } from '@/lib/date';
import { formatDelta, formatLoad, formatWeight } from '@/lib/format';

const RANGES = [
  { key: '1m', label: '1 month', days: 30 },
  { key: '3m', label: '3 months', days: 90 },
  { key: '6m', label: '6 months', days: 182 },
  { key: '1y', label: '1 year', days: 365 },
] as const;

type RangeKey = (typeof RANGES)[number]['key'];

type GlowUpTimelineProps = {
  today: string;
  weightEntries: WeightEntry[];
  goalKg: number | null;
  habits: Habit[];
  completions: Pick<HabitCompletion, 'habit_id' | 'log_date' | 'status'>[];
  workouts: Pick<Tables<'workouts'>, 'id' | 'workout_date' | 'status' | 'name'>[];
  setHistory: SetWithContext[];
  exercises: { id: string; name: string }[];
  skincareEntries: Pick<Tables<'skincare_entries'>, 'log_date' | 'period' | 'status'>[];
  reviews: WeeklyReview[];
  milestones: TimelineMilestone[];
  photos: ProgressPhotoWithUrl[];
};

/**
 * The Glow-Up timeline.
 *
 * Two halves: a "then vs now" comparison across every tracked dimension, and a
 * chronological feed of what actually happened. Both are strictly descriptive —
 * the app reports numbers and shows the user's own words and photos back. It
 * never comments on appearance, and it never scores a period.
 */
export function GlowUpTimeline({
  today,
  weightEntries,
  goalKg,
  habits,
  completions,
  workouts,
  setHistory,
  exercises,
  skincareEntries,
  reviews,
  milestones,
  photos,
}: GlowUpTimelineProps) {
  const [range, setRange] = React.useState<RangeKey>('3m');

  const days = RANGES.find((r) => r.key === range)?.days ?? 90;
  const from = subDaysKey(today, days - 1);
  const rangeLabel = RANGES.find((r) => r.key === range)?.label ?? '';

  const inRangeWeights = weightEntries.filter((entry) => entry.entry_date >= from);
  const firstWeight = inRangeWeights[0] ?? null;
  const lastWeight = inRangeWeights[inRangeWeights.length - 1] ?? null;

  const summary = summariseWeight(inRangeWeights, { goalKg, today });

  // Workouts per week at the start vs the end of the window.
  const halfway = subDaysKey(today, Math.floor(days / 2));
  const completedWorkouts = workouts.filter((w) => w.status === 'completed');
  const earlyWorkouts = completedWorkouts.filter(
    (w) => w.workout_date >= from && w.workout_date < halfway,
  ).length;
  const lateWorkouts = completedWorkouts.filter((w) => w.workout_date >= halfway).length;
  const weeksPerHalf = Math.max(1, days / 2 / 7);

  const habitIds = habits.filter((h) => !h.is_optional && h.frequency === 'daily').map((h) => h.id);
  const earlyNutrition = consistencyRate(completions, habitIds, from, halfway);
  const lateNutrition = consistencyRate(completions, habitIds, halfway, today);

  const earlySkincare = {
    am: periodConsistency(skincareEntries, 'am', from, halfway),
    pm: periodConsistency(skincareEntries, 'pm', from, halfway),
  };
  const lateSkincare = {
    am: periodConsistency(skincareEntries, 'am', halfway, today),
    pm: periodConsistency(skincareEntries, 'pm', halfway, today),
  };

  // Biggest strength gains in the window, named.
  const strengthGains = exercises
    .map((exercise) => ({
      exercise,
      change: strengthChange(setHistory, exercise.id, from, today),
    }))
    .filter(
      (entry): entry is { exercise: { id: string; name: string }; change: NonNullable<ReturnType<typeof strengthChange>> } =>
        entry.change !== null && entry.change.deltaKg !== 0,
    )
    .sort((a, b) => Math.abs(b.change.deltaKg) - Math.abs(a.change.deltaKg))
    .slice(0, 3);

  // Merged chronological feed.
  const feed = React.useMemo(() => {
    type FeedItem = {
      id: string;
      date: string;
      kind: 'milestone' | 'review' | 'photo' | 'workout';
      title: string;
      body?: string;
      photo?: ProgressPhotoWithUrl;
    };

    const items: FeedItem[] = [];

    for (const milestone of milestones) {
      if (milestone.occurred_on < from) continue;
      items.push({
        id: `m-${milestone.id}`,
        date: milestone.occurred_on,
        kind: 'milestone',
        title: milestone.title,
        ...(milestone.description ? { body: milestone.description } : {}),
      });
    }

    for (const review of reviews) {
      if (review.week_start < from) continue;
      const change =
        review.start_weight_kg !== null && review.end_weight_kg !== null
          ? formatDelta(review.end_weight_kg - review.start_weight_kg)
          : null;
      items.push({
        id: `r-${review.id}`,
        date: review.week_start,
        kind: 'review',
        title: `Week review${review.feeling ? ` — felt ${review.feeling}` : ''}`,
        ...(review.notes ? { body: review.notes } : change ? { body: `Weight ${change}` } : {}),
      });
    }

    for (const photo of photos) {
      if (photo.taken_on < from) continue;
      items.push({
        id: `p-${photo.id}`,
        date: photo.taken_on,
        kind: 'photo',
        title: 'Progress photo',
        ...(photo.note ? { body: photo.note } : {}),
        photo,
      });
    }

    return items.sort((a, b) => b.date.localeCompare(a.date));
  }, [milestones, reviews, photos, from]);

  const hasData = inRangeWeights.length > 0 || completedWorkouts.length > 0 || feed.length > 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <ToggleGroup
          type="single"
          value={range}
          onValueChange={(value) => value && setRange(value as RangeKey)}
          aria-label="Time range"
        >
          {RANGES.map((option) => (
            <ToggleGroupItem key={option.key} value={option.key} className="px-2.5 text-xs">
              {option.key}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <AddMilestoneDialog today={today} />
      </div>

      {!hasData ? (
        <EmptyState
          icon={Sparkles}
          title={EMPTY_STATES.timeline.title}
          body={EMPTY_STATES.timeline.body}
        />
      ) : (
        <>
          <Card>
            <CardContent className="space-y-4 p-5">
              <div>
                <h2 className="text-sm font-semibold tracking-tight">Then and now</h2>
                <p className="text-xs text-muted-foreground">Across the last {rangeLabel}.</p>
              </div>

              <dl className="space-y-3">
                <ComparisonRow
                  icon={Scale}
                  label="Weight"
                  from={firstWeight ? formatWeight(firstWeight.weight_kg) : '—'}
                  to={lastWeight ? formatWeight(lastWeight.weight_kg) : '—'}
                  delta={summary.totalChangeKg !== null ? formatDelta(summary.totalChangeKg) : null}
                />

                <ComparisonRow
                  icon={Dumbbell}
                  label="Workouts"
                  from={`${(earlyWorkouts / weeksPerHalf).toFixed(1)}/week`}
                  to={`${(lateWorkouts / weeksPerHalf).toFixed(1)}/week`}
                  delta={null}
                />

                <ComparisonRow
                  icon={Salad}
                  label="Habit consistency"
                  from={`${earlyNutrition.rate}%`}
                  to={`${lateNutrition.rate}%`}
                  delta={
                    lateNutrition.rate - earlyNutrition.rate !== 0
                      ? formatDelta(lateNutrition.rate - earlyNutrition.rate, 'pts', 0)
                      : null
                  }
                />

                <ComparisonRow
                  icon={Sparkles}
                  label="Skincare"
                  from={`AM ${earlySkincare.am.rate}% · PM ${earlySkincare.pm.rate}%`}
                  to={`AM ${lateSkincare.am.rate}% · PM ${lateSkincare.pm.rate}%`}
                  delta={null}
                />
              </dl>

              {strengthGains.length > 0 ? (
                <div className="border-t border-border/60 pt-3">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Strength
                  </p>
                  <ul className="space-y-1.5">
                    {strengthGains.map(({ exercise, change }) => (
                      <li key={exercise.id} className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="truncate">{exercise.name}</span>
                        <span className="tabular shrink-0 text-muted-foreground">
                          {formatLoad(change.fromKg)} → {formatLoad(change.toKg)} kg
                          <span className="ml-2 font-medium text-foreground">
                            {formatDelta(change.deltaKg)}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {feed.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold tracking-tight">Along the way</h2>
              <ol className="space-y-3">
                {feed.map((item) => (
                  <li key={item.id}>
                    <Card>
                      <CardContent className="flex gap-3 p-4">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                          {item.kind === 'milestone' ? (
                            <Flag className="size-4" aria-hidden="true" />
                          ) : item.kind === 'review' ? (
                            <StickyNote className="size-4" aria-hidden="true" />
                          ) : (
                            <Sparkles className="size-4" aria-hidden="true" />
                          )}
                        </span>

                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-muted-foreground">
                            {formatDateKey(item.date, 'EEE d MMM yyyy')}
                          </p>
                          <p className="mt-0.5 text-sm font-medium">{item.title}</p>
                          {item.body ? (
                            <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                              {item.body}
                            </p>
                          ) : null}

                          {item.photo?.signedUrl ? (
                            <div className="relative mt-2 h-40 w-full overflow-hidden rounded-xl bg-muted">
                              <Image
                                src={item.photo.signedUrl}
                                alt={item.photo.note ?? 'Progress photo'}
                                fill
                                sizes="(max-width: 768px) 100vw, 400px"
                                className="object-cover"
                              />
                            </div>
                          ) : null}
                        </div>
                      </CardContent>
                    </Card>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

function ComparisonRow({
  icon: Icon,
  label,
  from,
  to,
  delta,
}: {
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  label: string;
  from: string;
  to: string;
  delta: string | null;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <dt className="w-28 shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd className="tabular min-w-0 flex-1 text-right text-sm">
        <span className="text-muted-foreground">{from}</span>
        <span className="mx-1.5 text-muted-foreground" aria-label="changed to">
          →
        </span>
        <span className="font-medium">{to}</span>
        {delta ? <span className="ml-2 text-xs text-muted-foreground">{delta}</span> : null}
      </dd>
    </div>
  );
}
