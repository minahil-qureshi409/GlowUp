import 'server-only';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/db/database.types';
import { env, serverEnv } from '@/lib/env';

/**
 * Service-role client. Bypasses RLS, so it is used for exactly one thing:
 * reading and writing `calendar_credentials`, which no client role may touch.
 *
 * Every call site must scope its own queries by `user_id` — the database will
 * not do it here.
 */
export function createAdminClient() {
  const { SUPABASE_SERVICE_ROLE_KEY } = serverEnv();

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set. It is required for calendar token storage.',
    );
  }

  return createSupabaseClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
