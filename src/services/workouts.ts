import 'server-only';

import type { SupabaseServerClient } from '@/lib/supabase/server';
import type { Tables } from '@/lib/db/database.types';
import type { DateKey } from '@/lib/date';
import type { SetWithContext } from '@/lib/domain/workout';

export type Exercise = Tables<'exercises'>;
export type WorkoutTemplate = Tables<'workout_templates'>;
export type Workout = Tables<'workouts'>;

export type TemplateWithExercises = WorkoutTemplate & {
  exercises: (Tables<'workout_template_exercises'> & { exercise: Exercise })[];
};

export type WorkoutDetail = Workout & {
  exercises: (Tables<'workout_exercises'> & {
    exercise: Exercise;
    sets: Tables<'exercise_sets'>[];
  })[];
};

export async function getExercises(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<Exercise[]> {
  const { data, error } = await supabase
    .from('exercises')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('name');

  if (error) throw error;
  return data ?? [];
}

export async function getTemplates(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<TemplateWithExercises[]> {
  const { data, error } = await supabase
    .from('workout_templates')
    .select('*, exercises:workout_template_exercises(*, exercise:exercises(*))')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('sort_order');

  if (error) throw error;

  return (data ?? []).map((template) => ({
    ...template,
    exercises: [...(template.exercises ?? [])]
      .filter((row): row is (typeof row) & { exercise: Exercise } => Boolean(row.exercise))
      .sort((a, b) => a.sort_order - b.sort_order),
  }));
}

export async function getWorkouts(
  supabase: SupabaseServerClient,
  userId: string,
  options: { from?: DateKey; to?: DateKey; limit?: number } = {},
): Promise<Workout[]> {
  let query = supabase
    .from('workouts')
    .select('*')
    .eq('user_id', userId)
    .order('workout_date', { ascending: false });

  if (options.from) query = query.gte('workout_date', options.from);
  if (options.to) query = query.lte('workout_date', options.to);
  if (options.limit) query = query.limit(options.limit);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getWorkoutDetail(
  supabase: SupabaseServerClient,
  userId: string,
  workoutId: string,
): Promise<WorkoutDetail | null> {
  const { data, error } = await supabase
    .from('workouts')
    .select('*, exercises:workout_exercises(*, exercise:exercises(*), sets:exercise_sets(*))')
    .eq('user_id', userId)
    .eq('id', workoutId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    ...data,
    exercises: [...(data.exercises ?? [])]
      .filter((row): row is (typeof row) & { exercise: Exercise } => Boolean(row.exercise))
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((row) => ({
        ...row,
        sets: [...(row.sets ?? [])].sort((a, b) => a.set_index - b.set_index),
      })),
  };
}

export async function getActiveWorkout(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<Workout | null> {
  const { data, error } = await supabase
    .from('workouts')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'in_progress')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

/**
 * Every logged set across a window, flattened for the progression maths.
 *
 * The join is done in one query and flattened here rather than in the domain
 * layer, so the pure functions stay ignorant of PostgREST's response shape.
 */
export async function getSetHistory(
  supabase: SupabaseServerClient,
  userId: string,
  from: DateKey,
): Promise<SetWithContext[]> {
  const { data, error } = await supabase
    .from('workouts')
    .select(
      'id, workout_date, status, exercises:workout_exercises(exercise_id, sets:exercise_sets(reps, weight_kg, is_warmup, completed))',
    )
    .eq('user_id', userId)
    .eq('status', 'completed')
    .gte('workout_date', from)
    .order('workout_date');

  if (error) throw error;

  const flattened: SetWithContext[] = [];
  for (const workout of data ?? []) {
    for (const workoutExercise of workout.exercises ?? []) {
      for (const set of workoutExercise.sets ?? []) {
        flattened.push({
          workoutId: workout.id,
          exerciseId: workoutExercise.exercise_id,
          date: workout.workout_date,
          reps: set.reps,
          weight_kg: set.weight_kg,
          is_warmup: set.is_warmup,
          completed: set.completed,
        });
      }
    }
  }

  return flattened;
}

/** The last completed session for an exercise — the basis for "last time". */
export async function getLastSetsForExercise(
  supabase: SupabaseServerClient,
  userId: string,
  exerciseId: string,
  excludeWorkoutId?: string,
): Promise<{ date: DateKey; sets: Tables<'exercise_sets'>[] } | null> {
  let query = supabase
    .from('workout_exercises')
    .select('id, workout:workouts!inner(id, workout_date, status), sets:exercise_sets(*)')
    .eq('user_id', userId)
    .eq('exercise_id', exerciseId)
    .eq('workouts.status', 'completed')
    .order('workout_date', { referencedTable: 'workouts', ascending: false })
    .limit(5);

  if (excludeWorkoutId) query = query.neq('workout_id', excludeWorkoutId);

  const { data, error } = await query;
  if (error) throw error;

  const candidates = (data ?? [])
    .filter((row) => row.workout && (row.sets ?? []).length > 0)
    .sort((a, b) => (b.workout?.workout_date ?? '').localeCompare(a.workout?.workout_date ?? ''));

  const latest = candidates[0];
  if (!latest?.workout) return null;

  return {
    date: latest.workout.workout_date,
    sets: [...(latest.sets ?? [])].sort((a, b) => a.set_index - b.set_index),
  };
}
