import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SessionLogger } from '@/components/workout/session-logger';

import { requireUser } from '@/server/auth';
import { getUserContext } from '@/services/profile';
import {
  getExercises,
  getLastSetsForExercise,
  getTemplates,
  getWorkoutDetail,
} from '@/services/workouts';
import { exerciseProgression, suggestedNextLoad, WORKOUT_LOCATION_LABELS } from '@/lib/domain/workout';
import { getSetHistory } from '@/services/workouts';
import { formatDateKey, subDaysKey, todayIn } from '@/lib/date';

export const metadata: Metadata = { title: 'Session' };
export const dynamic = 'force-dynamic';

export default async function WorkoutSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, userId } = await requireUser();

  const workout = await getWorkoutDetail(supabase, userId, id);
  if (!workout) notFound();

  const context = await getUserContext(supabase, userId);
  const today = todayIn(context.profile.timezone);

  const [exercises, templates, setHistory] = await Promise.all([
    getExercises(supabase, userId),
    getTemplates(supabase, userId),
    getSetHistory(supabase, userId, subDaysKey(today, 180)),
  ]);

  // "Last time" numbers, one query per exercise in the session. Small n, and
  // it keeps the previous-session lookup honest about which workout it came from.
  const previousEntries = await Promise.all(
    workout.exercises.map(async (row) => {
      const last = await getLastSetsForExercise(supabase, userId, row.exercise_id, workout.id);
      if (!last) return null;
      return [
        row.exercise_id,
        {
          date: last.date,
          sets: last.sets.map((set) => ({
            setIndex: set.set_index,
            reps: set.reps,
            weightKg: set.weight_kg,
          })),
        },
      ] as const;
    }),
  );

  const previousByExercise = Object.fromEntries(
    previousEntries.filter((entry): entry is NonNullable<typeof entry> => entry !== null),
  );

  // Progression nudges, only where the last session genuinely cleared the range.
  const template = templates.find((t) => t.id === workout.template_id);
  const suggestionByExercise: Record<string, { weightKg: number; reason: string }> = {};

  for (const row of workout.exercises) {
    const history = exerciseProgression(setHistory, row.exercise_id).filter(
      (point) => point.date < workout.workout_date,
    );
    const last = history[history.length - 1];
    if (!last) continue;

    const templateRow = template?.exercises.find((t) => t.exercise_id === row.exercise_id);
    const suggestion = suggestedNextLoad(
      { topSetKg: last.topSetKg, totalReps: last.totalReps },
      templateRow?.target_reps_max ?? 12,
      templateRow?.target_sets ?? 3,
    );
    if (suggestion) suggestionByExercise[row.exercise_id] = suggestion;
  }

  return (
    <div className="animate-fade-up space-y-4 py-3">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" asChild>
          <Link href="/workout" aria-label="Back to workouts">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-xl tracking-tight">
            {workout.name}
          </h1>
          <p className="text-xs text-muted-foreground">
            {formatDateKey(workout.workout_date, 'EEE d MMM')} ·{' '}
            {WORKOUT_LOCATION_LABELS[workout.location]}
          </p>
        </div>
        {workout.status === 'completed' ? <Badge variant="success">Completed</Badge> : null}
      </div>

      <SessionLogger
        workout={workout}
        exercises={exercises}
        previousByExercise={previousByExercise}
        suggestionByExercise={suggestionByExercise}
      />
    </div>
  );
}
