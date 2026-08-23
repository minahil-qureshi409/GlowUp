import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { ChevronRight, Dumbbell, Trophy } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader, SectionHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';
import { Stat, StatGrid } from '@/components/common/stat';
import { StartWorkout } from '@/components/workout/start-workout';

import { requireUser } from '@/server/auth';
import { getUserContext } from '@/services/profile';
import { getActiveWorkout, getSetHistory, getTemplates, getWorkouts } from '@/services/workouts';
import { getExercises } from '@/services/workouts';

import {
  MUSCLE_GROUP_LABELS,
  WORKOUT_LOCATION_LABELS,
  personalBests,
  strengthChange,
  totalVolume,
  workoutsThisWeek,
} from '@/lib/domain/workout';
import { EMPTY_STATES } from '@/lib/domain/copy';
import { currentDayHour, dayOfWeek, formatDateKey, subDaysKey, timeToHour, todayIn } from '@/lib/date';
import { formatDelta, formatLoad, formatVolume } from '@/lib/format';

export const metadata: Metadata = { title: 'Workout' };
export const dynamic = 'force-dynamic';

export default async function WorkoutPage() {
  const { supabase, userId } = await requireUser();
  const context = await getUserContext(supabase, userId);

  const now = new Date();
  const timezone = context.profile.timezone;
  const today = todayIn(timezone, now);
  const twelveWeeksAgo = subDaysKey(today, 83);

  const [templates, workouts, setHistory, exercises, activeWorkout] = await Promise.all([
    getTemplates(supabase, userId),
    getWorkouts(supabase, userId, { from: twelveWeeksAgo, limit: 40 }),
    getSetHistory(supabase, userId, twelveWeeksAgo),
    getExercises(supabase, userId),
    getActiveWorkout(supabase, userId),
  ]);

  const completedThisWeek = workoutsThisWeek(workouts, today);
  const target = context.settings.workouts_per_week;
  const completed = workouts.filter((workout) => workout.status === 'completed');

  const bests = personalBests(setHistory);
  const exerciseById = new Map(exercises.map((exercise) => [exercise.id, exercise]));

  // Biggest load gains over the window — the "hip thrust +5 kg" line.
  const gains = exercises
    .map((exercise) => strengthChange(setHistory, exercise.id, twelveWeeksAgo, today))
    .filter((change): change is NonNullable<typeof change> => change !== null && change.deltaKg > 0)
    .sort((a, b) => b.deltaKg - a.deltaKg)
    .slice(0, 3);

  const totalVolumeAll = totalVolume(setHistory);

  // Office gym availability, evaluated against the women's-only window.
  const gymAccessEnd = timeToHour(context.gym?.access_end ?? null);
  const hourNow = currentDayHour(timezone, now);
  const gymDayOk = context.gym?.available_days?.includes(dayOfWeek(today)) ?? false;
  const gymOpen =
    Boolean(context.gym) && gymDayOk && (gymAccessEnd === null || hourNow < gymAccessEnd - 0.75);

  const officeGym = context.gym
    ? {
        name: context.gym.name,
        available: gymOpen,
        reason: !gymDayOk
          ? 'Not available today'
          : gymAccessEnd !== null && hourNow >= gymAccessEnd - 0.75
            ? 'Access hours have passed'
            : null,
      }
    : null;

  return (
    <div className="animate-fade-up space-y-6 py-3">
      <PageHeader
        title="Workout"
        description="A weekly count, not fixed days. Train when it fits."
      />

      {activeWorkout ? (
        <Card className="border-primary/30 bg-primary-soft/50">
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="text-sm font-medium">Session in progress</p>
              <p className="truncate text-xs text-muted-foreground">
                {activeWorkout.name} · {WORKOUT_LOCATION_LABELS[activeWorkout.location]}
              </p>
            </div>
            <Button asChild variant="brand" size="sm">
              <Link href={`/workout/session/${activeWorkout.id}`}>Resume</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="tabular font-display text-display-md leading-none">
                {completedThisWeek}
                <span className="text-xl text-muted-foreground"> / {target}</span>
              </p>
              <p className="mt-1 text-sm text-muted-foreground">sessions this week</p>
            </div>
            {completedThisWeek >= target && target > 0 ? (
              <Badge variant="success">Week complete</Badge>
            ) : null}
          </div>

          <Progress
            value={target === 0 ? 100 : Math.min(100, (completedThisWeek / target) * 100)}
            aria-label={`${completedThisWeek} of ${target} sessions this week`}
          />

          <Suspense fallback={<Skeleton className="h-11 w-full" />}>
            <StartWorkout templates={templates} today={today} officeGym={officeGym} />
          </Suspense>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <StatGrid columns={3}>
            <Stat label="Sessions" value={completed.length} hint="last 12 weeks" />
            <Stat label="Volume" value={formatVolume(totalVolumeAll)} hint="reps × weight" />
            <Stat
              label="Exercises"
              value={new Set(setHistory.map((set) => set.exerciseId)).size}
              hint="trained"
            />
          </StatGrid>
        </CardContent>
      </Card>

      {gains.length > 0 ? (
        <section className="space-y-3">
          <SectionHeader title="Getting stronger" description="Top-set change over 12 weeks" />
          <Card>
            <CardContent className="p-2">
              <ul className="divide-y divide-border/70">
                {gains.map((gain) => {
                  const exercise = exerciseById.get(gain.exerciseId);
                  if (!exercise) return null;
                  return (
                    <li key={gain.exerciseId}>
                      <Link
                        href={`/workout/exercises/${gain.exerciseId}`}
                        className="flex items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-muted/50"
                      >
                        <Trophy className="size-4 shrink-0 text-domain-workout" aria-hidden="true" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{exercise.name}</span>
                          <span className="tabular block text-xs text-muted-foreground">
                            {formatLoad(gain.fromKg)} → {formatLoad(gain.toKg)} kg over {gain.weeks}{' '}
                            {gain.weeks === 1 ? 'week' : 'weeks'}
                          </span>
                        </span>
                        <span className="tabular shrink-0 text-sm font-medium">
                          {formatDelta(gain.deltaKg)}
                        </span>
                        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        </section>
      ) : null}

      <section className="space-y-3">
        <SectionHeader title="Your templates" />
        <ul className="space-y-2">
          {templates.map((template) => (
            <li key={template.id}>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="font-medium">{template.name}</h3>
                    <span className="text-xs text-muted-foreground">{template.focus}</span>
                  </div>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    {template.exercises
                      .map((row) => row.exercise.name)
                      .slice(0, 4)
                      .join(' · ')}
                    {template.exercises.length > 4 ? ` +${template.exercises.length - 4}` : ''}
                  </p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <SectionHeader title="Recent sessions" />
        {completed.length > 0 ? (
          <Card>
            <CardContent className="p-2">
              <ul className="divide-y divide-border/70">
                {completed.slice(0, 8).map((workout) => (
                  <li key={workout.id}>
                    <Link
                      href={`/workout/session/${workout.id}`}
                      className="flex items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-muted/50"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{workout.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {formatDateKey(workout.workout_date, 'EEE d MMM')} ·{' '}
                          {WORKOUT_LOCATION_LABELS[workout.location]}
                          {workout.duration_minutes ? ` · ${workout.duration_minutes} min` : ''}
                        </span>
                      </span>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : (
          <EmptyState
            icon={Dumbbell}
            title={EMPTY_STATES.workouts.title}
            body={EMPTY_STATES.workouts.body}
          />
        )}
      </section>

      {bests.size > 0 ? (
        <section className="space-y-3">
          <SectionHeader title="Personal bests" description="Heaviest completed working set" />
          <Card>
            <CardContent className="p-2">
              <ul className="divide-y divide-border/70">
                {[...bests.values()]
                  .filter((best) => best.bestWeightKg !== null)
                  .sort((a, b) => (b.bestWeightKg ?? 0) - (a.bestWeightKg ?? 0))
                  .slice(0, 8)
                  .map((best) => {
                    const exercise = exerciseById.get(best.exerciseId);
                    if (!exercise) return null;
                    return (
                      <li key={best.exerciseId}>
                        <Link
                          href={`/workout/exercises/${best.exerciseId}`}
                          className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-muted/50"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm">{exercise.name}</span>
                            <span className="block text-xs text-muted-foreground">
                              {MUSCLE_GROUP_LABELS[exercise.muscle_group]}
                            </span>
                          </span>
                          <span className="tabular shrink-0 text-sm font-medium">
                            {formatLoad(best.bestWeightKg)} kg × {best.bestWeightReps ?? '—'}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
              </ul>
            </CardContent>
          </Card>
        </section>
      ) : null}
    </div>
  );
}
