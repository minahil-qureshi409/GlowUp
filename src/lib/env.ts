import { z } from 'zod';

/**
 * Environment access.
 *
 * Public and server variables are validated separately so a missing service-role
 * key can never be surfaced to the browser bundle, and so the client schema can
 * be parsed eagerly (Next inlines `process.env.NEXT_PUBLIC_*` at build time,
 * which means the whole object must be referenced statically — hence the
 * explicit property access below rather than a loop).
 */

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('NEXT_PUBLIC_SUPABASE_URL must be a valid URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required'),
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
});

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),

  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  /** Legacy single-provider override. `CALENDAR_REDIRECT_BASE_URL` supersedes it. */
  GOOGLE_REDIRECT_URI: z.string().url().optional(),

  MICROSOFT_CLIENT_ID: z.string().min(1).optional(),
  MICROSOFT_CLIENT_SECRET: z.string().min(1).optional(),
  /** `common` covers personal and work accounts; a GUID pins one tenant. */
  MICROSOFT_TENANT: z.string().min(1).optional(),

  /** 32 bytes, hex or base64. Encrypts OAuth tokens at rest. */
  CALENDAR_TOKEN_KEY: z.string().min(1).optional(),
  CALENDAR_REDIRECT_BASE_URL: z.string().url().optional(),
  /** Shared secret for the scheduled sync endpoint. */
  CALENDAR_SYNC_SECRET: z.string().min(16).optional(),
});

function parsePublic() {
  const parsed = publicSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  });

  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  • ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(
      `Missing or invalid Supabase environment variables:\n${issues}\n\n` +
        'Copy .env.example to .env.local and fill in your project values.',
    );
  }

  return parsed.data;
}

export const env = parsePublic();

/** Server-only secrets. Never import this from a client component. */
export function serverEnv() {
  return serverSchema.parse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI,
    MICROSOFT_CLIENT_ID: process.env.MICROSOFT_CLIENT_ID,
    MICROSOFT_CLIENT_SECRET: process.env.MICROSOFT_CLIENT_SECRET,
    MICROSOFT_TENANT: process.env.MICROSOFT_TENANT,
    CALENDAR_TOKEN_KEY: process.env.CALENDAR_TOKEN_KEY,
    CALENDAR_REDIRECT_BASE_URL: process.env.CALENDAR_REDIRECT_BASE_URL,
    CALENDAR_SYNC_SECRET: process.env.CALENDAR_SYNC_SECRET,
  });
}

export function siteUrl(): string {
  if (env.NEXT_PUBLIC_SITE_URL) return env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

/** Where a provider's OAuth callback lands. Must match what is registered. */
export function calendarRedirectUri(provider: string): string {
  const { CALENDAR_REDIRECT_BASE_URL, GOOGLE_REDIRECT_URI } = serverEnv();

  // An existing deployment may only have the old single-provider variable set;
  // honour it rather than silently changing a registered redirect URI.
  if (provider === 'google' && GOOGLE_REDIRECT_URI && !CALENDAR_REDIRECT_BASE_URL) {
    return GOOGLE_REDIRECT_URI;
  }

  const base = (CALENDAR_REDIRECT_BASE_URL ?? siteUrl()).replace(/\/$/, '');
  return `${base}/api/calendar/${provider}/callback`;
}

/**
 * Calendar credentials are optional.
 *
 * When a provider's variables are absent the UI keeps its honest "Not
 * configured on this deployment" state rather than showing a Connect button
 * that fails on click, and nothing here throws — the page must still render.
 */
export function googleCalendarConfig() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = serverEnv();
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) return null;
  if (!calendarTokenKeyConfigured()) return null;
  return {
    clientId: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    redirectUri: calendarRedirectUri('google'),
  };
}

export function microsoftCalendarConfig() {
  const { MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, MICROSOFT_TENANT } = serverEnv();
  if (!MICROSOFT_CLIENT_ID || !MICROSOFT_CLIENT_SECRET) return null;
  if (!calendarTokenKeyConfigured()) return null;
  return {
    clientId: MICROSOFT_CLIENT_ID,
    clientSecret: MICROSOFT_CLIENT_SECRET,
    // `common` lets both personal Microsoft accounts and work/school accounts
    // sign in. A tenant GUID restricts it to one organisation.
    tenant: MICROSOFT_TENANT ?? 'common',
    redirectUri: calendarRedirectUri('outlook'),
  };
}

/**
 * Whether tokens can be stored safely.
 *
 * Treated as part of a provider's configuration on purpose: without an
 * encryption key the app would have to write refresh tokens in the clear, and
 * it would rather show "not configured" than do that quietly.
 */
export function calendarTokenKeyConfigured(): boolean {
  return Boolean(serverEnv().CALENDAR_TOKEN_KEY);
}
