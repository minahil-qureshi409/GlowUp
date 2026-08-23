import 'server-only';

import type { SupabaseServerClient } from '@/lib/supabase/server';
import type { Tables } from '@/lib/db/database.types';
import type { DateKey } from '@/lib/date';

export type WeightEntry = Tables<'weight_entries'>;
export type Goal = Tables<'goals'>;
export type GoalMilestone = Tables<'goal_milestones'>;

export type WeightGoalContext = {
  goal: Goal | null;
  milestones: GoalMilestone[];
};

export async function getWeightEntries(
  supabase: SupabaseServerClient,
  userId: string,
  options: { from?: DateKey; limit?: number } = {},
): Promise<WeightEntry[]> {
  let query = supabase
    .from('weight_entries')
    .select('*')
    .eq('user_id', userId)
    .order('entry_date', { ascending: true });

  if (options.from) query = query.gte('entry_date', options.from);
  if (options.limit) query = query.limit(options.limit);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getLatestWeightEntry(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<WeightEntry | null> {
  const { data, error } = await supabase
    .from('weight_entries')
    .select('*')
    .eq('user_id', userId)
    .order('entry_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

/** The primary weight goal and its milestones, ordered low to high. */
export async function getWeightGoal(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<WeightGoalContext> {
  const { data: goal, error: goalError } = await supabase
    .from('goals')
    .select('*')
    .eq('user_id', userId)
    .eq('type', 'weight')
    .eq('status', 'active')
    .order('is_primary', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (goalError) throw goalError;
  if (!goal) return { goal: null, milestones: [] };

  const { data: milestones, error: milestoneError } = await supabase
    .from('goal_milestones')
    .select('*')
    .eq('goal_id', goal.id)
    .order('sort_order');

  if (milestoneError) throw milestoneError;
  return { goal, milestones: milestones ?? [] };
}

export async function getGoals(supabase: SupabaseServerClient, userId: string): Promise<Goal[]> {
  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .eq('user_id', userId)
    .neq('status', 'archived')
    .order('is_primary', { ascending: false })
    .order('created_at');

  if (error) throw error;
  return data ?? [];
}
