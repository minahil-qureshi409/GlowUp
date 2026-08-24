'use server';

import { revalidatePath } from 'next/cache';

import { requireUser } from '@/server/auth';
import { fromUnknownError, fromZodError, ok, type ActionResult } from '@/server/actions/result';
import { dailyMetricSchema, waterAdjustSchema } from '@/lib/validation/schemas';

/**
 * Nudges today's water count by one glass.
 *
 * The delta is sent rather than the total, so a stale client cannot overwrite a
 * count that moved underneath it — two devices a glass apart both add one,
 * instead of the slower one snapping the count back.
 *
 * The clamp is deliberately generous at the top: the goal is eight, but
 * drinking more than your goal is not an error to be rejected.
 */
export async function adjustWater(input: unknown): Promise<ActionResult<{ glasses: number }>> {
  const { supabase, userId } = await requireUser();
  const parsed = waterAdjustSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const { delta, metric_date } = parsed.data;

  try {
    const { data: existing, error: readError } = await supabase
      .from('daily_metrics')
      .select('water_glasses')
      .eq('user_id', userId)
      .eq('metric_date', metric_date)
      .maybeSingle();

    if (readError) throw readError;

    const next = Math.max(0, Math.min(30, (existing?.water_glasses ?? 0) + delta));

    const { data, error } = await supabase
      .from('daily_metrics')
      .upsert(
        { user_id: userId, metric_date, water_glasses: next },
        { onConflict: 'user_id,metric_date' },
      )
      .select('water_glasses')
      .single();

    if (error) throw error;

    revalidatePath('/today');
    revalidatePath('/habits');
    return ok({ glasses: data.water_glasses });
  } catch (error) {
    return fromUnknownError(error, 'adjustWater');
  }
}

/** Sleep, mood and an optional note for one day. Any field may be omitted. */
export async function logDailyMetric(input: unknown): Promise<ActionResult> {
  const { supabase, userId } = await requireUser();
  const parsed = dailyMetricSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    const { error } = await supabase.from('daily_metrics').upsert(
      {
        user_id: userId,
        metric_date: parsed.data.metric_date,
        sleep_hours: parsed.data.sleep_hours,
        mood: parsed.data.mood,
        note: parsed.data.note,
      },
      { onConflict: 'user_id,metric_date' },
    );

    if (error) throw error;

    revalidatePath('/today');
    revalidatePath('/habits');
    return ok();
  } catch (error) {
    return fromUnknownError(error, 'logDailyMetric');
  }
}
