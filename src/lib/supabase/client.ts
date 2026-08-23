'use client';

import { createBrowserClient } from '@supabase/ssr';

import type { Database } from '@/lib/db/database.types';
import { env } from '@/lib/env';

/**
 * Browser Supabase client.
 *
 * `createBrowserClient` already memoises per-tab, but callers get a stable
 * reference from here so React effects don't see a new client each render.
 */
let browserClient: ReturnType<typeof createBrowserClient<Database>> | undefined;

export function createClient() {
  browserClient ??= createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  return browserClient;
}

export type SupabaseBrowserClient = ReturnType<typeof createClient>;
