'use server';

import { revalidatePath } from 'next/cache';

import { requireUser } from '@/server/auth';
import { fail, fromUnknownError, fromZodError, ok, type ActionResult } from '@/server/actions/result';
import {
  progressPhotoSchema,
  timelineMilestoneSchema,
  weeklyReviewSchema,
} from '@/lib/validation/schemas';
import { weekEndKey } from '@/lib/date';
import { consistencyRate } from '@/lib/domain/habits';
import { periodConsistency } from '@/lib/domain/skincare';

const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic']);

/**
 * Uploads a progress photo.
 *
 * Photos live in a private bucket under `${userId}/`, which is what the storage
 * policies key on. Nothing about the image is analysed, described or scored —
 * it is stored and shown back, and that is all.
 */
export async function uploadProgressPhoto(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const { supabase, userId } = await requireUser();

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) return fail('Choose a photo to upload.');
  if (file.size > MAX_PHOTO_BYTES) return fail('That photo is larger than 10 MB.');
  if (!ALLOWED_PHOTO_TYPES.has(file.type)) return fail('Use a JPEG, PNG, WebP or HEIC image.');

  const parsed = progressPhotoSchema.safeParse({
    category: formData.get('category'),
    taken_on: formData.get('taken_on'),
    note: formData.get('note') || null,
  });
  if (!parsed.success) return fromZodError(parsed.error);

  const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const storagePath = `${userId}/${crypto.randomUUID()}.${extension}`;

  try {
    const { error: uploadError } = await supabase.storage
      .from('progress-photos')
      .upload(storagePath, file, { contentType: file.type, upsert: false });

    if (uploadError) throw uploadError;

    const { data, error } = await supabase
      .from('progress_photos')
      .insert({
        user_id: userId,
        storage_path: storagePath,
        category: parsed.data.category,
        taken_on: parsed.data.taken_on,
        note: parsed.data.note ?? null,
      })
      .select('id')
      .single();

    if (error) {
      // Don't leave an orphaned object behind if the row insert fails.
      await supabase.storage.from('progress-photos').remove([storagePath]);
      throw error;
    }

    revalidatePath('/progress/photos');
    revalidatePath('/progress/timeline');
    return ok({ id: data.id });
  } catch (error) {
    return fromUnknownError(error, 'uploadProgressPhoto');
  }
}

export async function deleteProgressPhoto(photoId: string): Promise<ActionResult> {
  const { supabase, userId } = await requireUser();

  try {
    const { data: photo, error: fetchError } = await supabase
      .from('progress_photos')
      .select('storage_path')
      .eq('id', photoId)
      .eq('user_id', userId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!photo) return fail('That photo no longer exists.');

    const { error } = await supabase
      .from('progress_photos')
      .delete()
      .eq('id', photoId)
      .eq('user_id', userId);

    if (error) throw error;

    await supabase.storage.from('progress-photos').remove([photo.storage_path]);

    revalidatePath('/progress/photos');
    return ok();
  } catch (error) {
    return fromUnknownError(error, 'deleteProgressPhoto');
  }
}

/** A short-lived signed URL so the user can save a copy of their own photo. */
export async function createPhotoDownloadUrl(photoId: string): Promise<ActionResult<{ url: string }>> {
  const { supabase, userId } = await requireUser();

  try {
    const { data: photo } = await supabase
      .from('progress_photos')
      .select('storage_path')
      .eq('id', photoId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!photo) return fail('That photo no longer exists.');

    const { data, error } = await supabase.storage
      .from('progress-photos')
      .createSignedUrl(photo.storage_path, 120, { download: true });

    if (error || !data) throw error ?? new Error('Could not create a link.');
    return ok({ url: data.signedUrl });
  } catch (error) {
    return fromUnknownError(error, 'createPhotoDownloadUrl');
  }
}

/**
 * Saves a weekly review and freezes that week's numbers alongside it.
 *
 * The counts are stored on the row rather than recomputed on read: if a habit
 * is renamed or retired next month, the review of this week should still say
 * what this week actually was.
 */
export async function saveWeeklyReview(input: unknown): Promise<ActionResult> {
  const { supabase, userId } = await requireUser();
  const parsed = weeklyReviewSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const weekStart = parsed.data.week_start;
  const weekEnd = weekEndKey(weekStart);

  try {
    const [habitsResult, completionsResult, workoutsResult, weightsResult, skincareResult] =
      await Promise.all([
        supabase.from('habits').select('id, name, category, is_optional, frequency').eq('user_id', userId),
        supabase
          .from('habit_completions')
          .select('habit_id, log_date, status')
          .eq('user_id', userId)
          .gte('log_date', weekStart)
          .lte('log_date', weekEnd),
        supabase
          .from('workouts')
          .select('id')
          .eq('user_id', userId)
          .eq('status', 'completed')
          .gte('workout_date', weekStart)
          .lte('workout_date', weekEnd),
        supabase
          .from('weight_entries')
          .select('weight_kg, entry_date')
          .eq('user_id', userId)
          .gte('entry_date', weekStart)
          .lte('entry_date', weekEnd)
          .order('entry_date'),
        supabase
          .from('skincare_entries')
          .select('log_date, period, status')
          .eq('user_id', userId)
          .gte('log_date', weekStart)
          .lte('log_date', weekEnd),
      ]);

    const habits = habitsResult.data ?? [];
    const completions = completionsResult.data ?? [];
    const weights = weightsResult.data ?? [];
    const skincare = skincareResult.data ?? [];

    const nutritionIds = habits
      .filter((h) => h.category === 'nutrition' && !h.is_optional && h.frequency === 'daily')
      .map((h) => h.id);

    const nutrition = consistencyRate(completions, nutritionIds, weekStart, weekEnd);
    const am = periodConsistency(skincare, 'am', weekStart, weekEnd);
    const pm = periodConsistency(skincare, 'pm', weekStart, weekEnd);

    const startWeight = weights[0]?.weight_kg ?? null;
    const endWeight = weights[weights.length - 1]?.weight_kg ?? null;

    const { error } = await supabase.from('weekly_reviews').upsert(
      {
        user_id: userId,
        week_start: weekStart,
        start_weight_kg: startWeight,
        end_weight_kg: endWeight,
        feeling: parsed.data.feeling,
        notes: parsed.data.notes,
        stats: {
          nutritionCompleted: nutrition.completed,
          nutritionOpportunities: nutrition.opportunities,
          nutritionRate: nutrition.rate,
          workoutsCompleted: workoutsResult.data?.length ?? 0,
          skincareAm: am.completedDays,
          skincarePm: pm.completedDays,
          skincareDays: am.totalDays,
          weighIns: weights.length,
        },
      },
      { onConflict: 'user_id,week_start' },
    );

    if (error) throw error;
    revalidatePath('/progress/review');
    revalidatePath('/progress/timeline');
    return ok();
  } catch (error) {
    return fromUnknownError(error, 'saveWeeklyReview');
  }
}

export async function saveTimelineMilestone(input: unknown): Promise<ActionResult<{ id: string }>> {
  const { supabase, userId } = await requireUser();
  const parsed = timelineMilestoneSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    if (parsed.data.id) {
      const { error } = await supabase
        .from('timeline_milestones')
        .update({
          occurred_on: parsed.data.occurred_on,
          title: parsed.data.title,
          description: parsed.data.description ?? null,
        })
        .eq('id', parsed.data.id)
        .eq('user_id', userId);

      if (error) throw error;
      revalidatePath('/progress/timeline');
      return ok({ id: parsed.data.id });
    }

    const { data, error } = await supabase
      .from('timeline_milestones')
      .insert({
        user_id: userId,
        occurred_on: parsed.data.occurred_on,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        kind: 'manual',
      })
      .select('id')
      .single();

    if (error) throw error;
    revalidatePath('/progress/timeline');
    return ok({ id: data.id });
  } catch (error) {
    return fromUnknownError(error, 'saveTimelineMilestone');
  }
}

export async function deleteTimelineMilestone(milestoneId: string): Promise<ActionResult> {
  const { supabase, userId } = await requireUser();

  try {
    const { error } = await supabase
      .from('timeline_milestones')
      .delete()
      .eq('id', milestoneId)
      .eq('user_id', userId);

    if (error) throw error;
    revalidatePath('/progress/timeline');
    return ok();
  } catch (error) {
    return fromUnknownError(error, 'deleteTimelineMilestone');
  }
}
