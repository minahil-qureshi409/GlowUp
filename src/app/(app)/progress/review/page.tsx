import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/common/empty-state';
import { SectionHeader } from '@/components/common/page-header';
import { WeeklyReviewForm } from '@/components/progress/weekly-review-form';

import { requireUser } from '@/server/auth';
import { getUserContext } from '@/services/profile';
import { getWeeklyReview, getWeeklyReviews } from '@/services/progress';
import { getActiveHabits, getCompletionsInRange } from '@/services/habits';
import { getWorkouts } from '@/services/workouts';
import { getWeightEntries } from '@/services/weight';
import { getEntriesInRange } from '@/services/skincare';

import { consistencyRate } from '@/lib/domain/habits';
import { periodConsistency } from '@/lib/domain/skincare';
import { EMPTY_STATES, TONE } from '@/lib/domain/copy';
import { formatDateKey, subDaysKey, todayIn, weekEndKey, weekStartKey } from '@/lib/date';
import { formatDelta } from '@/lib/format';

export const metadata: Metadata = { title: 'Weekly review' };
export const dynamic = 'force-dynamic';

export default async function WeeklyReviewPage() {
  const { supabase, userId } = await requireUser();
  const context = await getUserContext(supabase, userId);

  const today = todayIn(context.profile.timezone);
  const weekStart = weekStartKey(today);
  const weekEnd = weekEndKey(today);

  const [existing, pastReviews, habits, completions, workouts, weights, skincare] =
    await Promise.all([
      getWeeklyReview(supabase, userId, weekStart),
      getWeeklyReviews(supabase, userId, 12),
      getActiveHabits(supabase, userId),
      getCompletionsInRange(supabase, userId, weekStart, weekEnd),
      getWorkouts(supabase, userId, { from: weekStart, to: weekEnd }),
      getWeightEntries(supabase, userId, { from: subDaysKey(weekStart, 1) }),
      getEntriesInRange(supabase, userId, weekStart, weekEnd),
    ]);

  const nutritionIds = habits
    .filter((h) => h.category === 'nutrition' && !h.is_optional && h.frequency === 'daily')
    .map((h) => h.id);

  // The week is capped at today: an unfinished week should not read as a
  // week where things were missed.
  const cappedEnd = weekEnd > today ? today : weekEnd;

  const nutrition = consistencyRate(completions, nutritionIds, weekStart, cappedEnd);
  const am = periodConsistency(skincare, 'am', weekStart, cappedEnd);
  const pm = periodConsistency(skincare, 'pm', weekStart, cappedEnd);
  const completedWorkouts = workouts.filter((w) => w.status === 'completed').length;

  const weekWeights = weights.filter(
    (entry) => entry.entry_date >= weekStart && entry.entry_date <= cappedEnd,
  );
  const startWeight = weekWeights[0]?.weight_kg ?? null;
  const endWeight = weekWeights[weekWeights.length - 1]?.weight_kg ?? null;
  const weightChange =
    startWeight !== null && endWeight !== null ? endWeight - startWeight : null;

  const factualSummary = [
    nutritionIds.length > 0
      ? `You completed ${nutrition.completed} of ${nutrition.opportunities} food habits.`
      : null,
    `${completedWorkouts} ${completedWorkouts === 1 ? 'workout' : 'workouts'} logged.`,
    am.completedDays + pm.completedDays > 0
      ? `Skincare: ${am.completedDays} mornings, ${pm.completedDays} evenings.`
      : null,
    weightChange !== null ? `Weight ${formatDelta(weightChange)} across the week.` : null,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="animate-fade-up space-y-5 py-3">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" asChild>
          <Link href="/progress" aria-label="Back to progress">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="font-display text-xl tracking-tight">Weekly review</h1>
          <p className="text-xs text-muted-foreground">
            {formatDateKey(weekStart, 'd MMM')} – {formatDateKey(weekEnd, 'd MMM yyyy')}
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-4 p-5">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">This week, factually</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {factualSummary || TONE.quietWeek}
            </p>
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border/60 pt-4 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Start weight</dt>
              <dd className="tabular mt-0.5 font-medium">
                {startWeight !== null ? `${startWeight.toFixed(1)} kg` : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">End weight</dt>
              <dd className="tabular mt-0.5 font-medium">
                {endWeight !== null ? `${endWeight.toFixed(1)} kg` : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Change</dt>
              <dd className="tabular mt-0.5 font-medium">{formatDelta(weightChange)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Workouts</dt>
              <dd className="tabular mt-0.5 font-medium">{completedWorkouts}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Nutrition</dt>
              <dd className="tabular mt-0.5 font-medium">{nutrition.rate}%</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Skincare</dt>
              <dd className="tabular mt-0.5 font-medium">
                AM {am.completedDays} · PM {pm.completedDays}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <WeeklyReviewForm
        weekStart={weekStart}
        feeling={existing?.feeling ?? null}
        notes={existing?.notes ?? ''}
      />

      <section className="space-y-3">
        <SectionHeader title="Past weeks" />
        {pastReviews.filter((review) => review.week_start !== weekStart).length === 0 ? (
          <EmptyState
            variant="inline"
            title={EMPTY_STATES.reviews.title}
            body={EMPTY_STATES.reviews.body}
          />
        ) : (
          <ul className="space-y-2">
            {pastReviews
              .filter((review) => review.week_start !== weekStart)
              .map((review) => {
                const stats = (review.stats ?? {}) as Record<string, number | undefined>;
                const change =
                  review.start_weight_kg !== null && review.end_weight_kg !== null
                    ? review.end_weight_kg - review.start_weight_kg
                    : null;

                return (
                  <li key={review.id}>
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-baseline justify-between gap-3">
                          <p className="text-sm font-medium">
                            {formatDateKey(review.week_start, 'd MMM yyyy')}
                          </p>
                          {review.feeling ? (
                            <span className="text-xs capitalize text-muted-foreground">
                              {review.feeling}
                            </span>
                          ) : null}
                        </div>
                        <p className="tabular mt-1 text-xs text-muted-foreground">
                          {stats.workoutsCompleted ?? 0} workouts ·{' '}
                          {stats.nutritionRate ?? 0}% nutrition
                          {change !== null ? ` · ${formatDelta(change)}` : ''}
                        </p>
                        {review.notes ? (
                          <p className="mt-2 whitespace-pre-wrap text-sm">{review.notes}</p>
                        ) : null}
                      </CardContent>
                    </Card>
                  </li>
                );
              })}
          </ul>
        )}
      </section>
    </div>
  );
}
