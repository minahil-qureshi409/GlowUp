'use server';

import { revalidatePath } from 'next/cache';

import { requireUser } from '@/server/auth';
import { fail, fromUnknownError, fromZodError, ok, type ActionResult } from '@/server/actions/result';
import {
  goalSchema,
  gymConfigSchema,
  onboardingSchema,
  profileSchema,
  settingsSchema,
} from '@/lib/validation/schemas';
import { getUserToday, isValidTimezone } from '@/lib/date';

export async function updateProfile(input: unknown): Promise<ActionResult> {
  const { supabase, userId } = await requireUser();
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  if (!isValidTimezone(parsed.data.timezone)) {
    return fail('That timezone is not recognised.', { timezone: ['Pick a valid timezone'] });
  }

  try {
    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: parsed.data.display_name,
        height_cm: parsed.data.height_cm,
        timezone: parsed.data.timezone,
        time_format: parsed.data.time_format,
        theme: parsed.data.theme,
      })
      .eq('id', userId);

    if (error) throw error;
    revalidatePath('/settings');
    revalidatePath('/today');
    return ok();
  } catch (error) {
    return fromUnknownError(error, 'updateProfile');
  }
}

export async function updateSettings(input: unknown): Promise<ActionResult> {
  const { supabase, userId } = await requireUser();
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    const { error } = await supabase
      .from('user_settings')
      .update({
        workouts_per_week: parsed.data.workouts_per_week,
        preferred_workout_days: parsed.data.preferred_workout_days,
        typical_work_start: parsed.data.typical_work_start,
        typical_work_end: parsed.data.typical_work_end,
        commute_minutes: parsed.data.commute_minutes,
        weekly_weigh_in_day: parsed.data.weekly_weigh_in_day,
        notifications_enabled: parsed.data.notifications_enabled,
        quiet_hours_start: parsed.data.quiet_hours_start,
        quiet_hours_end: parsed.data.quiet_hours_end,
        max_daily_reminders: parsed.data.max_daily_reminders,
        suggestions_enabled: parsed.data.suggestions_enabled,
      })
      .eq('user_id', userId);

    if (error) throw error;
    revalidatePath('/settings');
    revalidatePath('/today');
    return ok();
  } catch (error) {
    return fromUnknownError(error, 'updateSettings');
  }
}

/**
 * Adds a preferred workout day without disturbing the others — the action
 * behind the "keep Wednesdays?" suggestion.
 */
export async function addPreferredWorkoutDay(weekday: number): Promise<ActionResult> {
  const { supabase, userId } = await requireUser();
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) return fail('Invalid day.');

  try {
    const { data: settings, error: fetchError } = await supabase
      .from('user_settings')
      .select('preferred_workout_days')
      .eq('user_id', userId)
      .maybeSingle();

    if (fetchError) throw fetchError;

    const next = [...new Set([...(settings?.preferred_workout_days ?? []), weekday])].sort();

    const { error } = await supabase
      .from('user_settings')
      .update({ preferred_workout_days: next })
      .eq('user_id', userId);

    if (error) throw error;
    revalidatePath('/today');
    revalidatePath('/settings');
    return ok();
  } catch (error) {
    return fromUnknownError(error, 'addPreferredWorkoutDay');
  }
}

export async function saveGymConfig(input: unknown): Promise<ActionResult<{ id: string }>> {
  const { supabase, userId } = await requireUser();
  const parsed = gymConfigSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    if (parsed.data.id) {
      const { error } = await supabase
        .from('gym_configs')
        .update({
          name: parsed.data.name,
          location: parsed.data.location ?? null,
          access_start: parsed.data.access_start,
          access_end: parsed.data.access_end,
          available_days: parsed.data.available_days,
          equipment: parsed.data.equipment,
        })
        .eq('id', parsed.data.id)
        .eq('user_id', userId);

      if (error) throw error;
      revalidateGymViews();
      return ok({ id: parsed.data.id });
    }

    const { data, error } = await supabase
      .from('gym_configs')
      .insert({
        user_id: userId,
        name: parsed.data.name,
        location: parsed.data.location ?? null,
        access_start: parsed.data.access_start,
        access_end: parsed.data.access_end,
        available_days: parsed.data.available_days,
        equipment: parsed.data.equipment,
      })
      .select('id')
      .single();

    if (error) throw error;
    revalidateGymViews();
    return ok({ id: data.id });
  } catch (error) {
    return fromUnknownError(error, 'saveGymConfig');
  }
}

export async function saveGoal(input: unknown): Promise<ActionResult<{ id: string }>> {
  const { supabase, userId } = await requireUser();
  const parsed = goalSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    if (parsed.data.id) {
      const { error } = await supabase
        .from('goals')
        .update({
          title: parsed.data.title,
          description: parsed.data.description ?? null,
          start_value: parsed.data.start_value,
          target_value: parsed.data.target_value,
          unit: parsed.data.unit ?? null,
        })
        .eq('id', parsed.data.id)
        .eq('user_id', userId);

      if (error) throw error;
      revalidatePath('/progress');
      revalidatePath('/settings');
      return ok({ id: parsed.data.id });
    }

    const { data, error } = await supabase
      .from('goals')
      .insert({
        user_id: userId,
        type: parsed.data.type,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        start_value: parsed.data.start_value,
        target_value: parsed.data.target_value,
        unit: parsed.data.unit ?? null,
      })
      .select('id')
      .single();

    if (error) throw error;
    revalidatePath('/progress');
    revalidatePath('/settings');
    return ok({ id: data.id });
  } catch (error) {
    return fromUnknownError(error, 'saveGoal');
  }
}

/**
 * Applies the onboarding answers and marks onboarding done.
 *
 * The signup trigger has already seeded habits, exercises, routines and goals,
 * so this only adjusts what the user actually chose — it never re-seeds.
 */
export async function completeOnboarding(input: unknown): Promise<ActionResult> {
  const { supabase, userId } = await requireUser();
  const parsed = onboardingSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const data = parsed.data;
  if (!isValidTimezone(data.timezone)) {
    return fail('That timezone is not recognised.', { timezone: ['Pick a valid timezone'] });
  }

  try {
    // The user's local day, not the server's. `new Date().toISOString()` here
    // is what stamped a brand-new Karachi account's first weigh-in with
    // yesterday's date when they signed up just after local midnight.
    const today = getUserToday(data.timezone);

    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        display_name: data.display_name,
        height_cm: data.height_cm,
        timezone: data.timezone,
        time_format: data.time_format,
        onboarding_completed_at: new Date().toISOString(),
      })
      .eq('id', userId);
    if (profileError) throw profileError;

    const { error: settingsError } = await supabase
      .from('user_settings')
      .update({
        workouts_per_week: data.workouts_per_week,
        preferred_workout_days: data.preferred_workout_days,
        typical_work_start: data.typical_work_start,
        typical_work_end: data.typical_work_end,
        notifications_enabled: data.notifications_enabled,
      })
      .eq('user_id', userId);
    if (settingsError) throw settingsError;

    // The first weigh-in is real user data, not seed data.
    const { error: weightError } = await supabase.from('weight_entries').upsert(
      {
        user_id: userId,
        weight_kg: data.current_weight_kg,
        entry_date: today,
        source: 'user',
      },
      { onConflict: 'user_id,entry_date' },
    );
    if (weightError) throw weightError;

    const { data: goal } = await supabase
      .from('goals')
      .select('id')
      .eq('user_id', userId)
      .eq('type', 'weight')
      .eq('is_primary', true)
      .maybeSingle();

    if (goal) {
      await supabase
        .from('goals')
        .update({
          start_value: data.current_weight_kg,
          target_value: data.goal_weight_kg,
          title: `Reach around ${data.goal_weight_kg} kg`,
        })
        .eq('id', goal.id)
        .eq('user_id', userId);

      // Rebuild the milestone ladder around the chosen start and target.
      await supabase.from('goal_milestones').delete().eq('goal_id', goal.id).eq('user_id', userId);
      await supabase
        .from('goal_milestones')
        .insert(buildMilestones(userId, goal.id, data.current_weight_kg, data.goal_weight_kg));
    }

    if (data.gym_access_end) {
      await supabase
        .from('gym_configs')
        .update({ access_end: data.gym_access_end })
        .eq('user_id', userId)
        .eq('is_default', true);
    }

    // Habits the user unticked are deactivated rather than deleted, so turning
    // one back on later restores its history too.
    const { data: habits } = await supabase.from('habits').select('id').eq('user_id', userId);
    const enabled = new Set(data.enabled_habit_ids);
    const toDisable = (habits ?? []).filter((h) => !enabled.has(h.id)).map((h) => h.id);

    if (toDisable.length > 0) {
      await supabase
        .from('habits')
        .update({ is_active: false })
        .in('id', toDisable)
        .eq('user_id', userId);
    }

    revalidatePath('/', 'layout');
    return ok();
  } catch (error) {
    return fromUnknownError(error, 'completeOnboarding');
  }
}

/**
 * An evenly spaced ladder between start and target.
 *
 * Deliberately value-based, never date-based: the app does not predict when a
 * number will be reached.
 */
function buildMilestones(userId: string, goalId: string, startKg: number, targetKg: number) {
  const rows = [
    { user_id: userId, goal_id: goalId, label: 'Starting point', target_value: startKg, sort_order: 0 },
  ];

  const span = targetKg - startKg;
  if (Math.abs(span) >= 3) {
    const steps = Math.min(3, Math.max(1, Math.round(Math.abs(span) / 2.5)));
    for (let i = 1; i <= steps; i += 1) {
      const value = Number((startKg + (span * i) / (steps + 1)).toFixed(1));
      rows.push({
        user_id: userId,
        goal_id: goalId,
        label: `Milestone ${i}`,
        target_value: value,
        sort_order: i,
      });
    }
  }

  rows.push({
    user_id: userId,
    goal_id: goalId,
    label: 'Goal',
    target_value: targetKg,
    sort_order: rows.length,
  });

  return rows;
}

function revalidateGymViews() {
  revalidatePath('/settings');
  revalidatePath('/today');
  revalidatePath('/workout');
}
