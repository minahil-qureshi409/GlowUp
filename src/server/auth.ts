import 'server-only';

import { redirect } from 'next/navigation';

import { demoModeEnabled, serverEnv } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient, type SupabaseServerClient } from '@/lib/supabase/server';

export type AuthedContext = {
  supabase: SupabaseServerClient;
  userId: string;
  email: string | null;
};

/**
 * The single entry point for any server code that needs a user.
 *
 * Uses `getUser()`, which validates the JWT against the auth server, rather
 * than `getSession()`, which trusts whatever is in the cookie. Middleware
 * already redirects unauthenticated traffic; this is the belt to that braces,
 * and it is what gives every service a `userId` it can rely on.
 */
export async function requireUser(): Promise<AuthedContext> {
  if (demoModeEnabled()) {
    const { DEMO_USER_ID } = serverEnv();
    return { supabase: createAdminClient(), userId: DEMO_USER_ID!, email: null };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect('/login');
  }

  return { supabase, userId: user.id, email: user.email ?? null };
}

/** Same check without the redirect, for routes that must handle both cases. */
export async function getOptionalUser(): Promise<AuthedContext | null> {
  if (demoModeEnabled()) {
    const { DEMO_USER_ID } = serverEnv();
    return { supabase: createAdminClient(), userId: DEMO_USER_ID!, email: null };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;
  return { supabase, userId: user.id, email: user.email ?? null };
}
