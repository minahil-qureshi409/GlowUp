'use server';

import { revalidatePath } from 'next/cache';

import { requireUser } from '@/server/auth';
import { fromUnknownError, fromZodError, ok, type ActionResult } from '@/server/actions/result';
import { weightEntrySchema } from '@/lib/validation/schemas';
import { newlyReachedMilestones } from '@/lib/domain/weight';

export type LogWeightResult = {
  entryId: string;
  /** Milestones crossed by this entry, so the UI can acknowledge them once. */
  reachedMilestones: { id: string; label: string; targetKg: number }[];
};

/**
 * Records a weigh-in.
 *
 * One entry per day by design — re-logging the same day updates it. Daily
 * weight is noisy enough that several readings a day would only add noise to
 * the trend, and the app is explicit that the trend is what matters.
 */
export async function logWeight(input: unknown): Promise<ActionResult<LogWeightResult>> {
  const { supabase, userId } = await requireUser();
  const parsed = weightEntrySchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    const { data, error } = await supabase
      .from('weight_entries')
      .upsert(
        {
          user_id: userId,
          weight_kg: parsed.data.weight_kg,
          entry_date: parsed.data.entry_date,
          note: parsed.data.note,
          source: 'user',
        },
        { onConflict: 'user_id,entry_date' },
      )
      .select('id')
      .single();

    if (error) throw error;

    const reached = await markMilestonesReached(supabase, userId, parsed.data.weight_kg);

    revalidatePath('/today');
    revalidatePath('/progress');
    return ok({ entryId: data.id, reachedMilestones: reached });
  } catch (error) {
    return fromUnknownError(error, 'logWeight');
  }
}

export async function deleteWeightEntry(entryId: string): Promise<ActionResult> {
  const { supabase, userId } = await requireUser();

  try {
    const { error } = await supabase
      .from('weight_entries')
      .delete()
      .eq('id', entryId)
      .eq('user_id', userId);

    if (error) throw error;
    revalidatePath('/today');
    revalidatePath('/progress');
    return ok();
  } catch (error) {
    return fromUnknownError(error, 'deleteWeightEntry');
  }
}

/**
 * Stamps `achieved_at` on any milestone this weight crosses.
 *
 * Once stamped it stays stamped — a later dip below the number does not undo
 * the milestone, because progress that happened is not un-happened by a
 * fluctuation.
 */
async function markMilestonesReached(
  supabase: Awaited<ReturnType<typeof requireUser>>['supabase'],
  userId: string,
  weightKg: number,
) {
  const { data: goal } = await supabase
    .from('goals')
    .select('id')
    .eq('user_id', userId)
    .eq('type', 'weight')
    .eq('status', 'active')
    .order('is_primary', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!goal) return [];

  const { data: milestones } = await supabase
    .from('goal_milestones')
    .select('id, label, target_value, achieved_at')
    .eq('goal_id', goal.id)
    .is('achieved_at', null);

  if (!milestones || milestones.length === 0) return [];

  const reached = newlyReachedMilestones(
    milestones.map((m) => ({
      id: m.id,
      label: m.label,
      targetKg: m.target_value,
      achievedAt: m.achieved_at,
    })),
    weightKg,
  );

  if (reached.length === 0) return [];

  const now = new Date().toISOString();
  await supabase
    .from('goal_milestones')
    .update({ achieved_at: now })
    .in(
      'id',
      reached.map((m) => m.id),
    )
    .eq('user_id', userId);

  // Milestones also land on the Glow-Up timeline, so the moment is preserved
  // rather than only celebrated once in a toast.
  await supabase.from('timeline_milestones').insert(
    reached.map((milestone) => ({
      user_id: userId,
      occurred_on: now.slice(0, 10),
      title: `${milestone.label} — ${milestone.targetKg} kg`,
      kind: 'weight' as const,
    })),
  );

  return reached;
}
