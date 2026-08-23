import 'server-only';

import type { SupabaseServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { disconnectCalendar } from '@/services/calendar';
import { IMPLEMENTED_PROVIDER_IDS } from '@/lib/calendar/registry';

const PHOTO_BUCKET = 'progress-photos';

/**
 * Every table a user's data lives in.
 *
 * Listed explicitly rather than discovered, so a new table has to be added here
 * deliberately. An export that silently omits a table is a broken promise, and
 * so is a deletion that silently leaves one behind.
 */
const USER_TABLES = [
  'profiles',
  'user_settings',
  'gym_configs',
  'weight_entries',
  'goals',
  'goal_milestones',
  'shake_recipes',
  'shake_ingredients',
  'habits',
  'habit_completions',
  'exercises',
  'workout_templates',
  'workout_template_exercises',
  'workouts',
  'workout_exercises',
  'exercise_sets',
  'skincare_products',
  'skincare_routines',
  'skincare_routine_steps',
  'skincare_entries',
  'skincare_step_completions',
  'skin_logs',
  'progress_photos',
  'weekly_reviews',
  'timeline_milestones',
  'calendar_connections',
  'calendar_event_metadata',
  'reminders',
  'suggestion_dismissals',
] as const;

export type AccountExport = {
  exported_at: string;
  account: { id: string; email: string | null };
  note: string;
  data: Record<string, unknown[]>;
  photos: { storage_path: string; taken_on: string; category: string; note: string | null }[];
};

/**
 * Everything the account holds, as JSON.
 *
 * Read through the *user's* client, not the service-role one: RLS is then the
 * thing deciding what belongs to them, which is exactly the guarantee the
 * export is supposed to be making. `calendar_credentials` is deliberately
 * absent — OAuth tokens are credentials for someone else's system, not the
 * user's data, and putting live tokens in a file people email around would be
 * a genuinely bad idea.
 */
export async function buildAccountExport(
  supabase: SupabaseServerClient,
  userId: string,
  email: string | null,
): Promise<AccountExport> {
  const data: Record<string, unknown[]> = {};

  for (const table of USER_TABLES) {
    // `profiles` is keyed by the auth user id itself; everything else carries
    // `user_id`. The cast is because the generated types narrow the column
    // union per table, and this loop is deliberately table-agnostic.
    const ownerColumn = table === 'profiles' ? 'id' : 'user_id';
    const query = supabase.from(table).select('*') as unknown as {
      eq: (column: string, value: string) => Promise<{ data: unknown[] | null; error: unknown }>;
    };
    const { data: rows, error } = await query.eq(ownerColumn, userId);
    if (error) throw error;
    data[table] = rows ?? [];
  }

  const photos = (data['progress_photos'] ?? []) as {
    storage_path: string;
    taken_on: string;
    category: string;
    note: string | null;
  }[];

  return {
    exported_at: new Date().toISOString(),
    account: { id: userId, email },
    note: 'Your GlowUp data. Progress photo files are not embedded — download them from Progress → Photos. Calendar access tokens are excluded on purpose.',
    data,
    photos: photos.map((photo) => ({
      storage_path: photo.storage_path,
      taken_on: photo.taken_on,
      category: photo.category,
      note: photo.note,
    })),
  };
}

/**
 * Deletes the account and everything in it.
 *
 * Order matters, and the storage step is the one that is easy to get wrong:
 * `on delete cascade` clears the `progress_photos` *rows*, but the bucket does
 * not clear itself — the image files would sit there indefinitely after the
 * account that owned them was gone. So the objects are removed first, while
 * their paths can still be read.
 *
 * Calendar access is revoked upstream before anything local goes, for the same
 * reason: once the tokens are deleted there is nothing left to revoke with.
 */
export async function deleteAccount(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<void> {
  // 1. Revoke and clear calendar grants while the tokens still exist.
  for (const provider of IMPLEMENTED_PROVIDER_IDS) {
    try {
      await disconnectCalendar(userId, provider);
    } catch (error) {
      console.error('[account:delete] calendar disconnect failed', provider, error);
    }
  }

  // 2. Remove the photo objects from storage.
  const { data: photos } = await supabase
    .from('progress_photos')
    .select('storage_path')
    .eq('user_id', userId);

  const paths = (photos ?? []).map((photo) => photo.storage_path).filter(Boolean);
  if (paths.length > 0) {
    const { error } = await supabase.storage.from(PHOTO_BUCKET).remove(paths);
    if (error) console.error('[account:delete] photo removal failed', error);
  }

  // Anything the database does not know about — an upload whose row insert
  // failed, say — would otherwise be orphaned forever. The bucket is scoped
  // per user by folder, so listing one folder is a complete sweep.
  const admin = createAdminClient();
  const { data: listed } = await admin.storage.from(PHOTO_BUCKET).list(userId, { limit: 1000 });
  const strays = (listed ?? []).map((entry) => `${userId}/${entry.name}`);
  if (strays.length > 0) {
    await admin.storage.from(PHOTO_BUCKET).remove(strays);
  }

  // 3. Delete the auth user. Every `public` table references `auth.users` with
  //    `on delete cascade`, so this is what actually removes the rows.
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw error;
}
