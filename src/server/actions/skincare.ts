'use server';

import { revalidatePath } from 'next/cache';

import { requireUser } from '@/server/auth';
import { fail, fromUnknownError, fromZodError, ok, type ActionResult } from '@/server/actions/result';
import {
  dateKeySchema,
  routineStepFormSchema,
  skinLogSchema,
  skincareProductSchema,
} from '@/lib/validation/schemas';
import type { Enums } from '@/lib/db/database.types';

/**
 * Marks one step of a routine.
 *
 * The parent entry is created on demand, and its status is recomputed from the
 * *required* steps only — an unticked optional step (the moisturiser) can never
 * hold a routine below complete.
 */
export async function setStepStatus(input: {
  date: string;
  period: Enums<'skincare_period'>;
  stepId: string;
  status: Enums<'completion_status'> | null;
  note?: string | null;
}): Promise<ActionResult<{ routineComplete: boolean }>> {
  const { supabase, userId } = await requireUser();

  const dateParsed = dateKeySchema.safeParse(input.date);
  if (!dateParsed.success) return fail('That date is not valid.');
  const logDate = dateParsed.data;

  try {
    const { data: entry, error: entryError } = await supabase
      .from('skincare_entries')
      .upsert(
        { user_id: userId, log_date: logDate, period: input.period, status: 'modified' },
        { onConflict: 'user_id,log_date,period', ignoreDuplicates: false },
      )
      .select('id')
      .single();

    if (entryError) throw entryError;

    if (input.status === null) {
      const { error } = await supabase
        .from('skincare_step_completions')
        .delete()
        .eq('entry_id', entry.id)
        .eq('step_id', input.stepId)
        .eq('user_id', userId);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('skincare_step_completions').upsert(
        {
          user_id: userId,
          entry_id: entry.id,
          step_id: input.stepId,
          status: input.status,
          note: input.note ?? null,
        },
        { onConflict: 'entry_id,step_id' },
      );
      if (error) throw error;
    }

    const routineComplete = await recomputeEntryStatus(supabase, userId, entry.id, input.period);

    revalidatePath('/skincare');
    revalidatePath('/today');
    return ok({ routineComplete });
  } catch (error) {
    return fromUnknownError(error, 'setStepStatus');
  }
}

/** One tap to complete every required step — the common case on a good day. */
export async function completeRoutine(
  date: string,
  period: Enums<'skincare_period'>,
): Promise<ActionResult> {
  const { supabase, userId } = await requireUser();

  const dateParsed = dateKeySchema.safeParse(date);
  if (!dateParsed.success) return fail('That date is not valid.');

  try {
    const { data: routine, error: routineError } = await supabase
      .from('skincare_routines')
      .select('id, steps:skincare_routine_steps(id, is_optional)')
      .eq('user_id', userId)
      .eq('period', period)
      .maybeSingle();

    if (routineError) throw routineError;
    if (!routine) return fail('That routine no longer exists.');

    const { data: entry, error: entryError } = await supabase
      .from('skincare_entries')
      .upsert(
        { user_id: userId, log_date: dateParsed.data, period, status: 'completed' },
        { onConflict: 'user_id,log_date,period' },
      )
      .select('id')
      .single();

    if (entryError) throw entryError;

    // Optional steps are left untouched: "complete the routine" means the parts
    // that are actually part of it, and the user decides about the rest.
    const requiredSteps = (routine.steps ?? []).filter((step) => !step.is_optional);

    if (requiredSteps.length > 0) {
      const { error } = await supabase.from('skincare_step_completions').upsert(
        requiredSteps.map((step) => ({
          user_id: userId,
          entry_id: entry.id,
          step_id: step.id,
          status: 'completed' as const,
        })),
        { onConflict: 'entry_id,step_id' },
      );
      if (error) throw error;
    }

    await syncSkincareHabit(supabase, userId, dateParsed.data, period, true);

    revalidatePath('/skincare');
    revalidatePath('/today');
    return ok();
  } catch (error) {
    return fromUnknownError(error, 'completeRoutine');
  }
}

export async function clearRoutine(
  date: string,
  period: Enums<'skincare_period'>,
): Promise<ActionResult> {
  const { supabase, userId } = await requireUser();
  const dateParsed = dateKeySchema.safeParse(date);
  if (!dateParsed.success) return fail('That date is not valid.');

  try {
    const { error } = await supabase
      .from('skincare_entries')
      .delete()
      .eq('user_id', userId)
      .eq('log_date', dateParsed.data)
      .eq('period', period);

    if (error) throw error;

    await syncSkincareHabit(supabase, userId, dateParsed.data, period, false);

    revalidatePath('/skincare');
    revalidatePath('/today');
    return ok();
  } catch (error) {
    return fromUnknownError(error, 'clearRoutine');
  }
}

export async function saveSkinLog(input: unknown): Promise<ActionResult> {
  const { supabase, userId } = await requireUser();
  const parsed = skinLogSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    const { error } = await supabase.from('skin_logs').upsert(
      {
        user_id: userId,
        log_date: parsed.data.log_date,
        conditions: parsed.data.conditions,
        note: parsed.data.note ?? null,
      },
      { onConflict: 'user_id,log_date' },
    );

    if (error) throw error;
    revalidatePath('/skincare');
    return ok();
  } catch (error) {
    return fromUnknownError(error, 'saveSkinLog');
  }
}

export async function saveProduct(input: unknown): Promise<ActionResult<{ id: string }>> {
  const { supabase, userId } = await requireUser();
  const parsed = skincareProductSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    if (parsed.data.id) {
      const { error } = await supabase
        .from('skincare_products')
        .update({
          name: parsed.data.name,
          brand: parsed.data.brand ?? null,
          category: parsed.data.category,
          notes: parsed.data.notes ?? null,
        })
        .eq('id', parsed.data.id)
        .eq('user_id', userId);

      if (error) throw error;
      revalidatePath('/skincare');
      return ok({ id: parsed.data.id });
    }

    const { data, error } = await supabase
      .from('skincare_products')
      .insert({
        user_id: userId,
        name: parsed.data.name,
        brand: parsed.data.brand ?? null,
        category: parsed.data.category,
        notes: parsed.data.notes ?? null,
        source: 'user',
      })
      .select('id')
      .single();

    if (error) throw error;
    revalidatePath('/skincare');
    return ok({ id: data.id });
  } catch (error) {
    return fromUnknownError(error, 'saveProduct');
  }
}

/**
 * Creates or updates one routine step, product and all.
 *
 * A step is two rows: the product (what you put on your face) and the step
 * (where it sits in the routine, whether it is optional). The editor collects
 * them as one thing, so this action writes them as one thing.
 *
 * Every statement is scoped by `user_id` as well as by id. RLS already blocks a
 * crafted request for another user's step — `skincare_routine_steps` and
 * `skincare_products` are both in the owner-scoped policy loop, so no new
 * policy was needed — but the explicit predicate means a mistake here fails as
 * "not found" rather than relying on the database to be the only guard.
 */
export async function saveRoutineStep(input: unknown): Promise<ActionResult<{ id: string }>> {
  const { supabase, userId } = await requireUser();
  const parsed = routineStepFormSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  const data = parsed.data;

  try {
    const { data: routine, error: routineError } = await supabase
      .from('skincare_routines')
      .select('id')
      .eq('user_id', userId)
      .eq('period', data.period)
      .maybeSingle();

    if (routineError) throw routineError;
    if (!routine) return fail('That routine no longer exists.');

    // ── the product ──────────────────────────────────────────────────────────
    let productId: string | null = null;

    if (data.id) {
      const { data: existing, error: existingError } = await supabase
        .from('skincare_routine_steps')
        .select('product_id')
        .eq('id', data.id)
        .eq('user_id', userId)
        .maybeSingle();

      if (existingError) throw existingError;
      if (!existing) return fail('That step no longer exists.');
      productId = existing.product_id;
    }

    if (productId) {
      const { error } = await supabase
        .from('skincare_products')
        .update({ name: data.name, brand: data.brand, category: data.category })
        .eq('id', productId)
        .eq('user_id', userId);
      if (error) throw error;
    } else {
      const { data: product, error } = await supabase
        .from('skincare_products')
        .insert({
          user_id: userId,
          name: data.name,
          brand: data.brand,
          category: data.category,
          source: 'user',
        })
        .select('id')
        .single();
      if (error) throw error;
      productId = product.id;
    }

    // ── the step ─────────────────────────────────────────────────────────────
    if (data.id) {
      const { error } = await supabase
        .from('skincare_routine_steps')
        .update({ product_id: productId, label: data.note, is_optional: data.is_optional })
        .eq('id', data.id)
        .eq('user_id', userId);
      if (error) throw error;
      revalidateSkincare();
      return ok({ id: data.id });
    }

    // New steps go to the end. `sort_order` is read back rather than assumed so
    // two tabs adding a step cannot both claim the same position.
    const { data: last, error: lastError } = await supabase
      .from('skincare_routine_steps')
      .select('sort_order')
      .eq('user_id', userId)
      .eq('routine_id', routine.id)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastError) throw lastError;

    const { data: step, error: stepError } = await supabase
      .from('skincare_routine_steps')
      .insert({
        user_id: userId,
        routine_id: routine.id,
        product_id: productId,
        label: data.note,
        is_optional: data.is_optional,
        sort_order: Math.min(50, (last?.sort_order ?? -1) + 1),
      })
      .select('id')
      .single();

    if (stepError) throw stepError;
    revalidateSkincare();
    return ok({ id: step.id });
  } catch (error) {
    return fromUnknownError(error, 'saveRoutineStep');
  }
}

/**
 * Retires or restores a step.
 *
 * There is no delete, for the same reason habits have none: deleting the step
 * would cascade its `skincare_step_completions` away and quietly rewrite how
 * consistent someone was last month. Retiring hides it from today onward and
 * leaves the record alone.
 */
export async function setRoutineStepActive(
  stepId: string,
  isActive: boolean,
): Promise<ActionResult> {
  const { supabase, userId } = await requireUser();

  try {
    const { error } = await supabase
      .from('skincare_routine_steps')
      .update({ is_active: isActive })
      .eq('id', stepId)
      .eq('user_id', userId);

    if (error) throw error;
    revalidateSkincare();
    return ok();
  } catch (error) {
    return fromUnknownError(error, 'setRoutineStepActive');
  }
}

/**
 * Persists an explicit order.
 *
 * `sort_order` is the source of truth — the routine is never rendered in
 * insertion order, so a reorder survives a reload and shows up everywhere the
 * routine appears.
 */
export async function reorderRoutineSteps(orderedIds: string[]): Promise<ActionResult> {
  const { supabase, userId } = await requireUser();

  if (orderedIds.length === 0) return ok();
  if (orderedIds.length > 51) return fail('That is more steps than a routine can hold.');

  try {
    const results = await Promise.all(
      orderedIds.map((id, index) =>
        supabase
          .from('skincare_routine_steps')
          .update({ sort_order: index })
          .eq('id', id)
          .eq('user_id', userId),
      ),
    );

    const firstError = results.find((result) => result.error)?.error;
    if (firstError) throw firstError;

    revalidateSkincare();
    return ok();
  } catch (error) {
    return fromUnknownError(error, 'reorderRoutineSteps');
  }
}

function revalidateSkincare() {
  revalidatePath('/skincare');
  revalidatePath('/settings/skincare');
  revalidatePath('/today');
  // Step 5 of onboarding is the same editor, so it has to refresh too.
  revalidatePath('/onboarding');
}

/** Recomputes an entry's status from its required steps. */
async function recomputeEntryStatus(
  supabase: Awaited<ReturnType<typeof requireUser>>['supabase'],
  userId: string,
  entryId: string,
  period: Enums<'skincare_period'>,
): Promise<boolean> {
  const { data: entry } = await supabase
    .from('skincare_entries')
    .select('log_date, period')
    .eq('id', entryId)
    .maybeSingle();

  const { data: routine } = await supabase
    .from('skincare_routines')
    .select('steps:skincare_routine_steps(id, is_optional)')
    .eq('user_id', userId)
    .eq('period', period)
    .maybeSingle();

  const { data: completions } = await supabase
    .from('skincare_step_completions')
    .select('step_id, status')
    .eq('entry_id', entryId);

  const requiredIds = new Set(
    (routine?.steps ?? []).filter((step) => !step.is_optional).map((step) => step.id),
  );
  const doneIds = new Set(
    (completions ?? [])
      .filter((c) => c.status === 'completed' || c.status === 'modified')
      .map((c) => c.step_id),
  );

  const allRequiredDone =
    requiredIds.size > 0 && [...requiredIds].every((id) => doneIds.has(id));
  const anyDone = doneIds.size > 0;

  await supabase
    .from('skincare_entries')
    .update({ status: allRequiredDone ? 'completed' : anyDone ? 'modified' : 'skipped' })
    .eq('id', entryId)
    .eq('user_id', userId);

  if (entry) {
    await syncSkincareHabit(supabase, userId, entry.log_date, period, allRequiredDone);
  }

  return allRequiredDone;
}

/** Keeps the AM/PM skincare habits in step with the routine screens. */
async function syncSkincareHabit(
  supabase: Awaited<ReturnType<typeof requireUser>>['supabase'],
  userId: string,
  date: string,
  period: Enums<'skincare_period'>,
  complete: boolean,
) {
  const namePattern = period === 'am' ? 'AM skincare' : 'PM skincare';

  const { data: habit } = await supabase
    .from('habits')
    .select('id')
    .eq('user_id', userId)
    .eq('category', 'skincare')
    .eq('name', namePattern)
    .maybeSingle();

  if (!habit) return;

  if (complete) {
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
  } else {
    await supabase
      .from('habit_completions')
      .delete()
      .eq('user_id', userId)
      .eq('habit_id', habit.id)
      .eq('log_date', date);
  }
}
