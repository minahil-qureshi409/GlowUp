'use server';

import { revalidatePath } from 'next/cache';

import { requireUser } from '@/server/auth';
import { fail, fromUnknownError, fromZodError, ok, type ActionResult } from '@/server/actions/result';
import { habitCompletionSchema, habitSchema, dateKeySchema } from '@/lib/validation/schemas';
import type { Enums } from '@/lib/db/database.types';

/**
 * Records — or clears — a habit's status for a day.
 *
 * Passing `null` removes the row entirely rather than storing a "not done"
 * state. There is no such thing as a recorded failure in this app: an unlogged
 * habit is simply unlogged, and tapping a completed habit again undoes it.
 */
export async function setHabitStatus(input: {
  habitId: string;
  date: string;
  status: Enums<'completion_status'> | null;
  note?: string | null;
  modification?: string | null;
}): Promise<ActionResult<{ status: Enums<'completion_status'> | null }>> {
  const { supabase, userId } = await requireUser();

  const dateParsed = dateKeySchema.safeParse(input.date);
  if (!dateParsed.success) return fail('That date is not valid.');

  try {
    if (input.status === null) {
      const { error } = await supabase
        .from('habit_completions')
        .delete()
        .eq('user_id', userId)
        .eq('habit_id', input.habitId)
        .eq('log_date', dateParsed.data);

      if (error) throw error;
      revalidateHabitViews();
      return ok({ status: null });
    }

    const parsed = habitCompletionSchema.safeParse({
      habit_id: input.habitId,
      log_date: dateParsed.data,
      status: input.status,
      note: input.note ?? null,
      modification: input.modification ?? null,
    });
    if (!parsed.success) return fromZodError(parsed.error);

    const { error } = await supabase.from('habit_completions').upsert(
      {
        user_id: userId,
        habit_id: parsed.data.habit_id,
        log_date: parsed.data.log_date,
        status: parsed.data.status,
        note: parsed.data.note ?? null,
        modification: parsed.data.modification ?? null,
        completed_at: new Date().toISOString(),
      },
      { onConflict: 'habit_id,log_date' },
    );

    if (error) throw error;
    revalidateHabitViews();
    return ok({ status: parsed.data.status });
  } catch (error) {
    return fromUnknownError(error, 'setHabitStatus');
  }
}

export async function createHabit(input: unknown): Promise<ActionResult<{ id: string }>> {
  const { supabase, userId } = await requireUser();
  const parsed = habitSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    // New habits land at the end of the list.
    const { data: last } = await supabase
      .from('habits')
      .select('sort_order')
      .eq('user_id', userId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data, error } = await supabase
      .from('habits')
      .insert({
        user_id: userId,
        name: parsed.data.name,
        category: parsed.data.category,
        icon: parsed.data.icon ?? null,
        frequency: parsed.data.frequency,
        target_per_week: parsed.data.target_per_week,
        preferred_part: parsed.data.preferred_part,
        window_start: parsed.data.window_start,
        window_end: parsed.data.window_end,
        reminder_enabled: parsed.data.reminder_enabled,
        is_optional: parsed.data.is_optional,
        recipe_id: parsed.data.recipe_id ?? null,
        sort_order: (last?.sort_order ?? 0) + 10,
        source: 'user',
      })
      .select('id')
      .single();

    if (error) throw error;
    revalidateHabitViews();
    return ok({ id: data.id });
  } catch (error) {
    return fromUnknownError(error, 'createHabit');
  }
}

export async function updateHabit(input: unknown): Promise<ActionResult> {
  const { supabase, userId } = await requireUser();
  const parsed = habitSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  if (!parsed.data.id) return fail('Missing habit id.');

  try {
    const { error } = await supabase
      .from('habits')
      .update({
        name: parsed.data.name,
        category: parsed.data.category,
        icon: parsed.data.icon ?? null,
        frequency: parsed.data.frequency,
        target_per_week: parsed.data.target_per_week,
        preferred_part: parsed.data.preferred_part,
        window_start: parsed.data.window_start,
        window_end: parsed.data.window_end,
        reminder_enabled: parsed.data.reminder_enabled,
        is_optional: parsed.data.is_optional,
        recipe_id: parsed.data.recipe_id ?? null,
      })
      .eq('id', parsed.data.id)
      .eq('user_id', userId);

    if (error) throw error;
    revalidateHabitViews();
    return ok();
  } catch (error) {
    return fromUnknownError(error, 'updateHabit');
  }
}

/**
 * Retiring a habit deactivates it rather than deleting it, so the history that
 * references it stays intact and past weeks still add up.
 */
export async function setHabitActive(habitId: string, isActive: boolean): Promise<ActionResult> {
  const { supabase, userId } = await requireUser();

  try {
    const { error } = await supabase
      .from('habits')
      .update({ is_active: isActive })
      .eq('id', habitId)
      .eq('user_id', userId);

    if (error) throw error;
    revalidateHabitViews();
    return ok();
  } catch (error) {
    return fromUnknownError(error, 'setHabitActive');
  }
}

export async function reorderHabits(orderedIds: string[]): Promise<ActionResult> {
  const { supabase, userId } = await requireUser();

  try {
    // Sparse ordering leaves room to insert between two habits later without
    // rewriting the whole list.
    const updates = orderedIds.map((id, index) =>
      supabase
        .from('habits')
        .update({ sort_order: (index + 1) * 10 })
        .eq('id', id)
        .eq('user_id', userId),
    );

    const results = await Promise.all(updates);
    const firstError = results.find((result) => result.error)?.error;
    if (firstError) throw firstError;

    revalidateHabitViews();
    return ok();
  } catch (error) {
    return fromUnknownError(error, 'reorderHabits');
  }
}

export async function dismissSuggestion(key: string, forDate: string): Promise<ActionResult> {
  const { supabase, userId } = await requireUser();
  const dateParsed = dateKeySchema.safeParse(forDate);
  if (!dateParsed.success) return fail('That date is not valid.');

  try {
    const { error } = await supabase.from('suggestion_dismissals').upsert(
      { user_id: userId, suggestion_key: key, dismissed_for: dateParsed.data },
      { onConflict: 'user_id,suggestion_key,dismissed_for' },
    );

    if (error) throw error;
    revalidatePath('/today');
    return ok();
  } catch (error) {
    return fromUnknownError(error, 'dismissSuggestion');
  }
}

function revalidateHabitViews() {
  revalidatePath('/today');
  revalidatePath('/nutrition');
  revalidatePath('/skincare');
  revalidatePath('/progress');
}
