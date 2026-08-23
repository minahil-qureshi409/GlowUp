import 'server-only';

import type { SupabaseServerClient } from '@/lib/supabase/server';
import type { Tables } from '@/lib/db/database.types';

export type Profile = Tables<'profiles'>;
export type UserSettings = Tables<'user_settings'>;
export type GymConfig = Tables<'gym_configs'>;

export type UserContext = {
  profile: Profile;
  settings: UserSettings;
  gym: GymConfig | null;
  calendarConnected: boolean;
};

/**
 * Everything the shell needs, in one round trip's worth of parallel queries.
 *
 * Profile and settings rows are created by the `on_auth_user_created` trigger,
 * so they exist for any authenticated user. If one is somehow missing (a user
 * created before the trigger, say) it is repaired here rather than crashing the
 * app — the alternative is a blank screen the user can do nothing about.
 */
export async function getUserContext(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<UserContext> {
  const [profileResult, settingsResult, gymResult, calendarResult] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
    supabase.from('user_settings').select('*').eq('user_id', userId).maybeSingle(),
    supabase
      .from('gym_configs')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('is_default', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('calendar_connections')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'connected')
      .limit(1),
  ]);

  let profile = profileResult.data;
  if (!profile) {
    const { data, error } = await supabase
      .from('profiles')
      .insert({ id: userId })
      .select('*')
      .single();
    if (error) throw error;
    profile = data;
  }

  let settings = settingsResult.data;
  if (!settings) {
    const { data, error } = await supabase
      .from('user_settings')
      .insert({ user_id: userId })
      .select('*')
      .single();
    if (error) throw error;
    settings = data;
  }

  return {
    profile,
    settings,
    gym: gymResult.data ?? null,
    calendarConnected: (calendarResult.data?.length ?? 0) > 0,
  };
}

export async function getGyms(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<GymConfig[]> {
  const { data, error } = await supabase
    .from('gym_configs')
    .select('*')
    .eq('user_id', userId)
    .order('is_default', { ascending: false })
    .order('name');

  if (error) throw error;
  return data ?? [];
}
