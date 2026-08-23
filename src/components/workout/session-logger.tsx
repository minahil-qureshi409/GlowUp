'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, Trash2, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SetRow, type SetValues } from '@/components/workout/set-row';
import {
  addExerciseToWorkout,
  addSet,
  deleteSet,
  finishWorkout,
  removeExerciseFromWorkout,
  saveSet,
} from '@/server/actions/workouts';
import type { Exercise, WorkoutDetail } from '@/services/workouts';
import { MUSCLE_GROUP_LABELS, totalVolume } from '@/lib/domain/workout';
import { formatDateKey } from '@/lib/date';
import { formatLoad, formatVolume } from '@/lib/format';

type SessionLoggerProps = {
  workout: WorkoutDetail;
  exercises: Exercise[];
  /** Previous session's sets per exercise, keyed by exercise id. */
  previousByExercise: Record<
    string,
    { date: string; sets: { setIndex: number; reps: number | null; weightKg: number | null }[] }
  >;
  /** Optional progression nudge per exercise. Absent far more often than present. */
  suggestionByExercise: Record<string, { weightKg: number; reason: string }>;
};

export function SessionLogger({
  workout,
  exercises,
  previousByExercise,
  suggestionByExercise,
}: SessionLoggerProps) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [addingExercise, setAddingExercise] = React.useState(false);
  const [finishing, setFinishing] = React.useState(false);
  const [notes, setNotes] = React.useState(workout.notes ?? '');

  const isComplete = workout.status === 'completed';

  const allSets = workout.exercises.flatMap((row) =>
    row.sets.map((set) => ({
      reps: set.reps,
      weight_kg: set.weight_kg,
      is_warmup: set.is_warmup,
      completed: set.completed,
    })),
  );
  const volume = totalVolume(allSets);
  const completedSets = allSets.filter((set) => set.completed && !set.is_warmup).length;

  function updateSet(workoutExerciseId: string, set: SetValues, patch: Partial<SetValues>) {
    const next = { ...set, ...patch };
    startTransition(async () => {
      const result = await saveSet({
        workoutExerciseId,
        workoutId: workout.id,
        set: {
          id: next.id,
          set_index: next.setIndex,
          reps: next.reps,
          weight_kg: next.weightKg,
          is_warmup: next.isWarmup,
          completed: next.completed,
        },
      });
      if (!result.ok) toast.error(result.error);
    });
  }

  function run(action: () => Promise<{ ok: boolean; error?: string }>, success?: string) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) toast.error(result.error ?? 'That did not work.');
      else if (success) toast.success(success);
    });
  }

  function complete() {
    startTransition(async () => {
      const result = await finishWorkout({
        workout_id: workout.id,
        duration_minutes: null,
        notes: notes || null,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setFinishing(false);
      toast.success('Session logged ✨');
      router.push('/workout');
    });
  }

  const availableExercises = exercises.filter(
    (exercise) => !workout.exercises.some((row) => row.exercise_id === exercise.id),
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex items-center justify-between gap-4 p-4">
          <div>
            <p className="tabular font-display text-2xl leading-none">{completedSets}</p>
            <p className="text-xs text-muted-foreground">working sets</p>
          </div>
          <div className="text-right">
            <p className="tabular font-display text-2xl leading-none">{formatVolume(volume)}</p>
            <p className="text-xs text-muted-foreground">volume</p>
          </div>
        </CardContent>
      </Card>

      {workout.exercises.map((row) => {
        const previous = previousByExercise[row.exercise_id];
        const suggestion = suggestionByExercise[row.exercise_id];

        return (
          <Card key={row.id}>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate font-medium">{row.exercise.name}</h2>
                  <p className="text-xs text-muted-foreground">
                    {MUSCLE_GROUP_LABELS[row.exercise.muscle_group]}
                    {previous ? ` · last on ${formatDateKey(previous.date, 'd MMM')}` : ''}
                  </p>
                </div>
                {!isComplete ? (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="shrink-0 text-muted-foreground"
                    aria-label={`Remove ${row.exercise.name} from this session`}
                    onClick={() => run(() => removeExerciseFromWorkout(row.id, workout.id))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                ) : null}
              </div>

              {suggestion && !isComplete ? (
                <p className="flex items-start gap-2 rounded-lg bg-primary-soft/60 px-3 py-2 text-xs">
                  <TrendingUp className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
                  <span>
                    <span className="font-medium">
                      {formatLoad(suggestion.weightKg)} kg is an option today.
                    </span>{' '}
                    <span className="text-muted-foreground">
                      {suggestion.reason} Only if it feels right.
                    </span>
                  </span>
                </p>
              ) : null}

              <div className="grid grid-cols-[2rem_1fr_1fr_auto_auto] gap-2 px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <span className="text-center">Set</span>
                <span className="text-center">kg</span>
                <span className="text-center">Reps</span>
                <span className="w-9" />
                <span className="w-9" />
              </div>

              <ul className="space-y-1">
                {row.sets.map((set) => {
                  const values: SetValues = {
                    id: set.id,
                    setIndex: set.set_index,
                    reps: set.reps,
                    weightKg: set.weight_kg,
                    isWarmup: set.is_warmup,
                    completed: set.completed,
                  };
                  const previousSet = previous?.sets.find((s) => s.setIndex === set.set_index);

                  return (
                    <SetRow
                      key={set.id}
                      set={values}
                      previous={previousSet ?? null}
                      disabled={isComplete || pending}
                      onChange={(patch) => updateSet(row.id, values, patch)}
                      onDelete={() => run(() => deleteSet(set.id, workout.id))}
                    />
                  );
                })}
              </ul>

              {!isComplete ? (
                <Button
                  variant="subtle"
                  size="sm"
                  className="w-full"
                  onClick={() => run(() => addSet(row.id, workout.id))}
                  disabled={pending}
                >
                  <Plus className="size-4" />
                  Add set
                </Button>
              ) : null}
            </CardContent>
          </Card>
        );
      })}

      {!isComplete ? (
        <>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setAddingExercise(true)}
            disabled={availableExercises.length === 0}
          >
            <Plus className="size-4" />
            Add exercise
          </Button>

          <Button
            variant="brand"
            className="w-full"
            onClick={() => setFinishing(true)}
            disabled={pending}
          >
            {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            Finish session
          </Button>
        </>
      ) : null}

      {isComplete && workout.notes ? (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Notes</p>
            <p className="mt-1 text-sm">{workout.notes}</p>
          </CardContent>
        </Card>
      ) : null}

      <AddExerciseDialog
        open={addingExercise}
        exercises={availableExercises}
        onOpenChange={setAddingExercise}
        onSelect={(exerciseId) => {
          setAddingExercise(false);
          run(() => addExerciseToWorkout(workout.id, exerciseId));
        }}
      />

      <Dialog open={finishing} onOpenChange={setFinishing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Finish this session?</DialogTitle>
            <DialogDescription>
              Empty sets are dropped. Anything you logged is kept.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="workout-notes">How did it go? (optional)</Label>
            <Textarea
              id="workout-notes"
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="e.g. felt strong, hip thrusts moved well"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFinishing(false)}>
              Keep going
            </Button>
            <Button variant="brand" onClick={complete} disabled={pending}>
              {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              Finish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AddExerciseDialog({
  open,
  exercises,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  exercises: Exercise[];
  onOpenChange: (open: boolean) => void;
  onSelect: (exerciseId: string) => void;
}) {
  const [selected, setSelected] = React.useState<string>('');

  const grouped = React.useMemo(() => {
    const map = new Map<string, Exercise[]>();
    for (const exercise of exercises) {
      const key = MUSCLE_GROUP_LABELS[exercise.muscle_group];
      const bucket = map.get(key) ?? [];
      bucket.push(exercise);
      map.set(key, bucket);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [exercises]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add an exercise</DialogTitle>
        </DialogHeader>

        <Select value={selected} onValueChange={setSelected}>
          <SelectTrigger aria-label="Exercise">
            <SelectValue placeholder="Choose an exercise" />
          </SelectTrigger>
          <SelectContent>
            {grouped.map(([group, groupExercises]) => (
              <React.Fragment key={group}>
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">{group}</div>
                {groupExercises.map((exercise) => (
                  <SelectItem key={exercise.id} value={exercise.id}>
                    {exercise.name}
                  </SelectItem>
                ))}
              </React.Fragment>
            ))}
          </SelectContent>
        </Select>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="brand" disabled={!selected} onClick={() => onSelect(selected)}>
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
