import 'server-only';

import type { SupabaseServerClient } from '@/lib/supabase/server';
import type { Tables } from '@/lib/db/database.types';
import type { DateKey } from '@/lib/date';

export type ProgressPhoto = Tables<'progress_photos'>;
export type WeeklyReview = Tables<'weekly_reviews'>;
export type TimelineMilestone = Tables<'timeline_milestones'>;

export type ProgressPhotoWithUrl = ProgressPhoto & {
  /** Short-lived signed URL. The bucket is private; there are no public links. */
  signedUrl: string | null;
};

const SIGNED_URL_TTL_SECONDS = 60 * 30;

export async function getProgressPhotos(
  supabase: SupabaseServerClient,
  userId: string,
  options: { from?: DateKey; limit?: number } = {},
): Promise<ProgressPhotoWithUrl[]> {
  let query = supabase
    .from('progress_photos')
    .select('*')
    .eq('user_id', userId)
    .order('taken_on', { ascending: false });

  if (options.from) query = query.gte('taken_on', options.from);
  if (options.limit) query = query.limit(options.limit);

  const { data, error } = await query;
  if (error) throw error;

  const photos = data ?? [];
  if (photos.length === 0) return [];

  // One batched call rather than one per photo.
  const { data: signed } = await supabase.storage
    .from('progress-photos')
    .createSignedUrls(
      photos.map((photo) => photo.storage_path),
      SIGNED_URL_TTL_SECONDS,
    );

  const urlByPath = new Map((signed ?? []).map((row) => [row.path ?? '', row.signedUrl]));

  return photos.map((photo) => ({
    ...photo,
    signedUrl: urlByPath.get(photo.storage_path) ?? null,
  }));
}

export async function getWeeklyReviews(
  supabase: SupabaseServerClient,
  userId: string,
  limit = 26,
): Promise<WeeklyReview[]> {
  const { data, error } = await supabase
    .from('weekly_reviews')
    .select('*')
    .eq('user_id', userId)
    .order('week_start', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

export async function getWeeklyReview(
  supabase: SupabaseServerClient,
  userId: string,
  weekStart: DateKey,
): Promise<WeeklyReview | null> {
  const { data, error } = await supabase
    .from('weekly_reviews')
    .select('*')
    .eq('user_id', userId)
    .eq('week_start', weekStart)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

export async function getTimelineMilestones(
  supabase: SupabaseServerClient,
  userId: string,
  from?: DateKey,
): Promise<TimelineMilestone[]> {
  let query = supabase
    .from('timeline_milestones')
    .select('*')
    .eq('user_id', userId)
    .order('occurred_on', { ascending: false });

  if (from) query = query.gte('occurred_on', from);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}
