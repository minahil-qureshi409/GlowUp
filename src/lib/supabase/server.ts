import 'server-only';

import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

import type { Database } from '@/lib/db/database.types';
import { env } from '@/lib/env';

/**
 * Request-scoped Supabase client for Server Components, Server Actions and
 * Route Handlers. Every query runs as the signed-in user, so RLS is the
 * authorisation layer — there is no second, hand-rolled ownership check.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Components cannot set cookies. Refreshing the session is
            // the middleware's job, so it is safe to ignore this here.
          }
        },
      },
    },
  );
}

export type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
