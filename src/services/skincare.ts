import 'server-only';

import type { SupabaseServerClient } from '@/lib/supabase/server';
import type { Enums, Tables } from '@/lib/db/database.types';
import type { DateKey } from '@/lib/date';
import type { StepWithProduct } from '@/lib/domain/skincare';

export type SkincareProduct = Tables<'skincare_products'>;
export type SkincareEntry = Tables<'skincare_entries'>;
export type SkinLog = Tables<'skin_logs'>;

export type RoutineWithSteps = Tables<'skincare_routines'> & {
  steps: StepWithProduct[];
};

/**
 * The routines as they are lived day to day: active steps only.
 *
 * A retired step disappears from here the moment it is retired, but its past
 * `skincare_step_completions` rows are untouched, so Routine history and the
 * Glow-Up timeline still count the days it was done.
 */
export async function getRoutines(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<RoutineWithSteps[]> {
  const routines = await getRoutinesWithRetired(supabase, userId);
  return routines.map((routine) => ({
    ...routine,
    steps: routine.steps.filter((step) => step.is_active),
  }));
}

/** Every step, retired included — for the management screen only. */
export async function getRoutinesWithRetired(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<RoutineWithSteps[]> {
  const { data, error } = await supabase
    .from('skincare_routines')
    .select('*, steps:skincare_routine_steps(*, product:skincare_products(id, name, brand, category, notes))')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('period');

  if (error) throw error;

  return (data ?? []).map((routine) => ({
    ...routine,
    steps: [...(routine.steps ?? [])].sort((a, b) => a.sort_order - b.sort_order),
  }));
}

export async function getRoutine(
  supabase: SupabaseServerClient,
  userId: string,
  period: Enums<'skincare_period'>,
): Promise<RoutineWithSteps | null> {
  const routines = await getRoutines(supabase, userId);
  return routines.find((routine) => routine.period === period) ?? null;
}

export type EntryWithSteps = SkincareEntry & {
  step_completions: Tables<'skincare_step_completions'>[];
};

export async function getEntriesForDate(
  supabase: SupabaseServerClient,
  userId: string,
  date: DateKey,
): Promise<EntryWithSteps[]> {
  const { data, error } = await supabase
    .from('skincare_entries')
    .select('*, step_completions:skincare_step_completions(*)')
    .eq('user_id', userId)
    .eq('log_date', date);

  if (error) throw error;
  return (data ?? []).map((entry) => ({ ...entry, step_completions: entry.step_completions ?? [] }));
}

export async function getEntriesInRange(
  supabase: SupabaseServerClient,
  userId: string,
  from: DateKey,
  to: DateKey,
): Promise<Pick<SkincareEntry, 'log_date' | 'period' | 'status'>[]> {
  const { data, error } = await supabase
    .from('skincare_entries')
    .select('log_date, period, status')
    .eq('user_id', userId)
    .gte('log_date', from)
    .lte('log_date', to)
    .order('log_date');

  if (error) throw error;
  return data ?? [];
}

export async function getSkinLogs(
  supabase: SupabaseServerClient,
  userId: string,
  from: DateKey,
  to: DateKey,
): Promise<SkinLog[]> {
  const { data, error } = await supabase
    .from('skin_logs')
    .select('*')
    .eq('user_id', userId)
    .gte('log_date', from)
    .lte('log_date', to)
    .order('log_date', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getProducts(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<SkincareProduct[]> {
  const { data, error } = await supabase
    .from('skincare_products')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('category')
    .order('name');

  if (error) throw error;
  return data ?? [];
}
