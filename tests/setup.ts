/**
 * Test environment.
 *
 * `@/lib/env` validates the public Supabase variables eagerly at import time —
 * deliberately, so a misconfigured deployment fails at boot rather than on the
 * first query. Under Vitest that means anything transitively importing it needs
 * placeholder values. Nothing here is a real credential and nothing connects.
 */
process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://test-project.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'test-anon-key';
process.env.NEXT_PUBLIC_SITE_URL ??= 'http://localhost:3000';
