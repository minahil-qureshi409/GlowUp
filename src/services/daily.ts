import 'server-only';

import type { SupabaseServerClient } from '@/lib/supabase/server';
import type { Tables } from '@/lib/db/database.types';
import type { DateKey } from '@/lib/date';

export type DailyMetric = Tables<'daily_metrics'>;

/** Glasses in a full day. The Today card draws exactly this many slots. */
export const WATER_GOAL_GLASSES = 8;

/**
 * PostgREST's code for "that table is not in the schema cache".
 *
 * In practice it means one thing: `20260824010100_daily_metrics.sql` has not
 * been applied to this database yet. Hydration and sleep are additive — the
 * other three pillars, the habits, the weight trend and every other screen work
 * without them — so a missing migration degrades those two to "not logged"
 * instead of taking down Today. It is logged loudly and once per request so the
 * cause is never a mystery, and every *other* error still throws.
 */
const TABLE_MISSING = 'PGRST205';

function isTableMissing(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === TABLE_MISSING;
}

function warnMissingTable(): void {
  console.warn(
    '[daily_metrics] table not found — hydration and sleep will read as unlogged. ' +
      'Apply supabase/migrations/20260824010100_daily_metrics.sql to fix.',
  );
}

/**
 * The day's row, or null when nothing has been logged.
 *
 * Null is not zero. A day with no row means "not logged yet"; the caller
 * decides how to render that, and for sleep the honest rendering is a dash.
 */
export async function getDailyMetric(
  supabase: SupabaseServerClient,
  userId: string,
  date: DateKey,
): Promise<DailyMetric | null> {
  const { data, error } = await supabase
    .from('daily_metrics')
    .select('*')
    .eq('user_id', userId)
    .eq('metric_date', date)
    .maybeSingle();

  if (error) {
    if (isTableMissing(error)) {
      warnMissingTable();
      return null;
    }
    throw error;
  }
  return data ?? null;
}

export async function getDailyMetricsInRange(
  supabase: SupabaseServerClient,
  userId: string,
  from: DateKey,
  to: DateKey,
): Promise<DailyMetric[]> {
  const { data, error } = await supabase
    .from('daily_metrics')
    .select('*')
    .eq('user_id', userId)
    .gte('metric_date', from)
    .lte('metric_date', to)
    .order('metric_date', { ascending: true });

  if (error) {
    if (isTableMissing(error)) {
      warnMissingTable();
      return [];
    }
    throw error;
  }
  return data ?? [];
}
