import 'server-only';

import type { SupabaseServerClient } from '@/lib/supabase/server';
import type { Tables } from '@/lib/db/database.types';
import type { DateKey } from '@/lib/date';

export type Habit = Tables<'habits'>;
export type HabitCompletion = Tables<'habit_completions'>;

export async function getActiveHabits(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<Habit[]> {
  const { data, error } = await supabase
    .from('habits')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('sort_order');

  if (error) throw error;
  return data ?? [];
}

export async function getAllHabits(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<Habit[]> {
  const { data, error } = await supabase
    .from('habits')
    .select('*')
    .eq('user_id', userId)
    .order('is_active', { ascending: false })
    .order('sort_order');

  if (error) throw error;
  return data ?? [];
}

export async function getCompletionsForDate(
  supabase: SupabaseServerClient,
  userId: string,
  date: DateKey,
): Promise<HabitCompletion[]> {
  const { data, error } = await supabase
    .from('habit_completions')
    .select('*')
    .eq('user_id', userId)
    .eq('log_date', date);

  if (error) throw error;
  return data ?? [];
}

/**
 * Completions across a date range.
 *
 * Selects only the four columns the analytics functions actually read — a year
 * of history is a lot of rows, and the notes are never needed in aggregate.
 */
export async function getCompletionsInRange(
  supabase: SupabaseServerClient,
  userId: string,
  from: DateKey,
  to: DateKey,
): Promise<Pick<HabitCompletion, 'habit_id' | 'log_date' | 'status' | 'id'>[]> {
  const { data, error } = await supabase
    .from('habit_completions')
    .select('id, habit_id, log_date, status')
    .eq('user_id', userId)
    .gte('log_date', from)
    .lte('log_date', to)
    .order('log_date');

  if (error) throw error;
  return data ?? [];
}

export async function getDismissedSuggestions(
  supabase: SupabaseServerClient,
  userId: string,
  date: DateKey,
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('suggestion_dismissals')
    .select('suggestion_key')
    .eq('user_id', userId)
    .eq('dismissed_for', date);

  if (error) throw error;
  return new Set((data ?? []).map((row) => row.suggestion_key));
}
