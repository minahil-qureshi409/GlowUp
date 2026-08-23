'use server';

import { revalidatePath } from 'next/cache';

import { requireUser } from '@/server/auth';
import { fail, fromUnknownError, fromZodError, ok, type ActionResult } from '@/server/actions/result';
import {
  exerciseSchema,
  exerciseSetSchema,
  finishWorkoutSchema,
  startWorkoutSchema,
} from '@/lib/validation/schemas';

/**
 * Opens a session, optionally pre-filled from a template.
 *
 * A session starts `in_progress` and only counts toward the week once it is
 * finished — an abandoned session should never inflate the weekly total.
 */
export async function startWorkout(input: unknown): Promise<ActionResult<{ id: string }>> {
  const { supabase, userId } = await requireUser();
  const parsed = startWorkoutSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    const { data: workout, error } = await supabase
      .from('workouts')
      .insert({
        user_id: userId,
        template_id: parsed.data.template_id,
        name: parsed.data.name,
        workout_date: parsed.data.workout_date,
        location: parsed.data.location,
        status: 'in_progress',
        started_at: new Date().toISOString(),
        source: 'user',
      })
      .select('id')
      .single();

    if (error) throw error;

    if (parsed.data.template_id) {
      const { data: templateExercises, error: templateError } = await supabase
        .from('workout_template_exercises')
        .select('exercise_id, sort_order, target_sets')
        .eq('template_id', parsed.data.template_id)
        .eq('user_id', userId)
        .order('sort_order');

      if (templateError) throw templateError;

      if (templateExercises && templateExercises.length > 0) {
        const { data: inserted, error: insertError } = await supabase
          .from('workout_exercises')
          .insert(
            templateExercises.map((row) => ({
              user_id: userId,
              workout_id: workout.id,
              exercise_id: row.exercise_id,
              sort_order: row.sort_order,
            })),
          )
          .select('id, exercise_id');

        if (insertError) throw insertError;

        // Pre-create empty sets so logging is tapping numbers into rows that
        // already exist, rather than adding a row per set on a phone.
        const setRows = (inserted ?? []).flatMap((workoutExercise) => {
          const template = templateExercises.find(
            (t) => t.exercise_id === workoutExercise.exercise_id,
          );
          const count = template?.target_sets ?? 3;
          return Array.from({ length: count }, (_, index) => ({
            user_id: userId,
            workout_exercise_id: workoutExercise.id,
            set_index: index + 1,
            reps: null,
            weight_kg: null,
            completed: false,
          }));
        });

        if (setRows.length > 0) {
          const { error: setError } = await supabase.from('exercise_sets').insert(setRows);
          if (setError) throw setError;
        }
      }
    }

    revalidatePath('/workout');
    return ok({ id: workout.id });
  } catch (error) {
    return fromUnknownError(error, 'startWorkout');
  }
}

export async function addExerciseToWorkout(
  workoutId: string,
  exerciseId: string,
  setCount = 3,
): Promise<ActionResult<{ id: string }>> {
  const { supabase, userId } = await requireUser();

  try {
    const { data: last } = await supabase
      .from('workout_exercises')
      .select('sort_order')
      .eq('workout_id', workoutId)
      .eq('user_id', userId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data, error } = await supabase
      .from('workout_exercises')
      .insert({
        user_id: userId,
        workout_id: workoutId,
        exercise_id: exerciseId,
        sort_order: (last?.sort_order ?? -1) + 1,
      })
      .select('id')
      .single();

    if (error) throw error;

    const { error: setError } = await supabase.from('exercise_sets').insert(
      Array.from({ length: Math.max(1, Math.min(setCount, 10)) }, (_, index) => ({
        user_id: userId,
        workout_exercise_id: data.id,
        set_index: index + 1,
        completed: false,
      })),
    );
    if (setError) throw setError;

    revalidatePath(`/workout/session/${workoutId}`);
    return ok({ id: data.id });
  } catch (error) {
    return fromUnknownError(error, 'addExerciseToWorkout');
  }
}

export async function removeExerciseFromWorkout(
  workoutExerciseId: string,
  workoutId: string,
): Promise<ActionResult> {
  const { supabase, userId } = await requireUser();

  try {
    const { error } = await supabase
      .from('workout_exercises')
      .delete()
      .eq('id', workoutExerciseId)
      .eq('user_id', userId);

    if (error) throw error;
    revalidatePath(`/workout/session/${workoutId}`);
    return ok();
  } catch (error) {
    return fromUnknownError(error, 'removeExerciseFromWorkout');
  }
}

export async function saveSet(input: {
  workoutExerciseId: string;
  workoutId: string;
  set: unknown;
}): Promise<ActionResult<{ id: string }>> {
  const { supabase, userId } = await requireUser();
  const parsed = exerciseSetSchema.safeParse(input.set);
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    const { data, error } = await supabase
      .from('exercise_sets')
      .upsert(
        {
          ...(parsed.data.id ? { id: parsed.data.id } : {}),
          user_id: userId,
          workout_exercise_id: input.workoutExerciseId,
          set_index: parsed.data.set_index,
          reps: parsed.data.reps,
          weight_kg: parsed.data.weight_kg,
          rpe: parsed.data.rpe ?? null,
          is_warmup: parsed.data.is_warmup,
          completed: parsed.data.completed,
        },
        { onConflict: 'workout_exercise_id,set_index' },
      )
      .select('id')
      .single();

    if (error) throw error;
    revalidatePath(`/workout/session/${input.workoutId}`);
    return ok({ id: data.id });
  } catch (error) {
    return fromUnknownError(error, 'saveSet');
  }
}

export async function addSet(
  workoutExerciseId: string,
  workoutId: string,
): Promise<ActionResult<{ id: string }>> {
  const { supabase, userId } = await requireUser();

  try {
    const { data: last } = await supabase
      .from('exercise_sets')
      .select('set_index, reps, weight_kg')
      .eq('workout_exercise_id', workoutExerciseId)
      .eq('user_id', userId)
      .order('set_index', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data, error } = await supabase
      .from('exercise_sets')
      .insert({
        user_id: userId,
        workout_exercise_id: workoutExerciseId,
        set_index: (last?.set_index ?? 0) + 1,
        // Carry the previous set's numbers forward — most sets repeat, and
        // pre-filling means one tap instead of two number entries.
        reps: last?.reps ?? null,
        weight_kg: last?.weight_kg ?? null,
        completed: false,
      })
      .select('id')
      .single();

    if (error) throw error;
    revalidatePath(`/workout/session/${workoutId}`);
    return ok({ id: data.id });
  } catch (error) {
    return fromUnknownError(error, 'addSet');
  }
}

export async function deleteSet(setId: string, workoutId: string): Promise<ActionResult> {
  const { supabase, userId } = await requireUser();

  try {
    const { error } = await supabase
      .from('exercise_sets')
      .delete()
      .eq('id', setId)
      .eq('user_id', userId);

    if (error) throw error;
    revalidatePath(`/workout/session/${workoutId}`);
    return ok();
  } catch (error) {
    return fromUnknownError(error, 'deleteSet');
  }
}

export async function finishWorkout(input: unknown): Promise<ActionResult> {
  const { supabase, userId } = await requireUser();
  const parsed = finishWorkoutSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    const { data: workout, error: fetchError } = await supabase
      .from('workouts')
      .select('id, started_at, workout_date')
      .eq('id', parsed.data.workout_id)
      .eq('user_id', userId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!workout) return fail('That session no longer exists.');

    const completedAt = new Date();
    const duration =
      parsed.data.duration_minutes ??
      (workout.started_at
        ? Math.max(
            0,
            Math.min(
              600,
              Math.round((completedAt.getTime() - new Date(workout.started_at).getTime()) / 60000),
            ),
          )
        : null);

    const { error } = await supabase
      .from('workouts')
      .update({
        status: 'completed',
        completed_at: completedAt.toISOString(),
        duration_minutes: duration,
        notes: parsed.data.notes ?? null,
      })
      .eq('id', workout.id)
      .eq('user_id', userId);

    if (error) throw error;

    // Drop the placeholder sets that were never filled in, so the volume maths
    // isn't diluted by rows the user simply didn't use.
    const { data: workoutExercises } = await supabase
      .from('workout_exercises')
      .select('id')
      .eq('workout_id', workout.id)
      .eq('user_id', userId);

    const exerciseIds = (workoutExercises ?? []).map((row) => row.id);
    if (exerciseIds.length > 0) {
      await supabase
        .from('exercise_sets')
        .delete()
        .in('workout_exercise_id', exerciseIds)
        .eq('user_id', userId)
        .eq('completed', false)
        .is('reps', null)
        .is('weight_kg', null);
    }

    await markWorkoutHabitComplete(supabase, userId, workout.workout_date);

    revalidatePath('/workout');
    revalidatePath('/today');
    revalidatePath('/progress');
    return ok();
  } catch (error) {
    return fromUnknownError(error, 'finishWorkout');
  }
}

export async function deleteWorkout(workoutId: string): Promise<ActionResult> {
  const { supabase, userId } = await requireUser();

  try {
    const { error } = await supabase
      .from('workouts')
      .delete()
      .eq('id', workoutId)
      .eq('user_id', userId);

    if (error) throw error;
    revalidatePath('/workout');
    revalidatePath('/today');
    return ok();
  } catch (error) {
    return fromUnknownError(error, 'deleteWorkout');
  }
}

export async function createExercise(input: unknown): Promise<ActionResult<{ id: string }>> {
  const { supabase, userId } = await requireUser();
  const parsed = exerciseSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    const { data, error } = await supabase
      .from('exercises')
      .insert({
        user_id: userId,
        name: parsed.data.name,
        muscle_group: parsed.data.muscle_group,
        equipment: parsed.data.equipment ?? null,
        is_bodyweight: parsed.data.is_bodyweight,
        notes: parsed.data.notes ?? null,
        source: 'user',
      })
      .select('id')
      .single();

    if (error) throw error;
    revalidatePath('/workout');
    return ok({ id: data.id });
  } catch (error) {
    return fromUnknownError(error, 'createExercise');
  }
}

/**
 * Finishing a session also ticks the "Strength workout" habit for that day, so
 * the user never has to log the same thing twice.
 */
async function markWorkoutHabitComplete(
  supabase: Awaited<ReturnType<typeof requireUser>>['supabase'],
  userId: string,
  date: string,
) {
  const { data: habit } = await supabase
    .from('habits')
    .select('id')
    .eq('user_id', userId)
    .eq('category', 'workout')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (!habit) return;

  await supabase.from('habit_completions').upsert(
    {
      user_id: userId,
      habit_id: habit.id,
      log_date: date,
      status: 'completed',
      completed_at: new Date().toISOString(),
    },
    { onConflict: 'habit_id,log_date' },
  );
}
