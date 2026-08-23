import 'server-only';

/**
 * Rate limiting for the auth surface.
 *
 * Supabase applies its own limits, but they are per-project and generous enough
 * that a credential-stuffing run against one address stays comfortably inside
 * them. This adds a second, tighter limit at the action layer, keyed by both
 * IP and email so neither dimension alone is a way around it.
 *
 * ── The honest caveat ───────────────────────────────────────────────────────
 * The counters live in this process's memory. That is exactly right for a
 * single instance and for local development, and it is *not* enough on its own
 * across a horizontally-scaled deployment or a serverless platform that spins
 * up fresh isolates: an attacker who lands on a cold instance gets a fresh
 * budget. Before running behind more than one instance, reimplement
 * `checkRateLimit` and `resetRateLimit` against a shared store (Upstash, Redis,
 * a Postgres table) — everything else here calls through those two functions,
 * so nothing else has to change.
 */

export type RateLimitRule = {
  /** Requests allowed inside the window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
};

export type RateLimitResult = {
  ok: boolean;
  /** Attempts left in the current window. */
  remaining: number;
  /** Seconds until the window resets. Zero when not limited. */
  retryAfterSeconds: number;
};

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** Windows are short, so a lazy sweep on write is enough to bound the map. */
const MAX_TRACKED_KEYS = 10_000;

function sweep(now: number) {
  if (buckets.size < MAX_TRACKED_KEYS) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export function checkRateLimit(key: string, rule: RateLimitRule): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + rule.windowMs });
    return { ok: true, remaining: rule.limit - 1, retryAfterSeconds: 0 };
  }

  existing.count += 1;

  if (existing.count > rule.limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  return { ok: true, remaining: rule.limit - existing.count, retryAfterSeconds: 0 };
}

/** Clears a key's budget — called after a *successful* sign-in. */
export function resetRateLimit(key: string) {
  buckets.delete(key);
}

/**
 * Checks several keys as one decision.
 *
 * Sign-in is limited per IP *and* per email: the IP limit stops one machine
 * working through an address list, the email limit stops a distributed run
 * against a single account. Every key is consumed on every call so a request
 * cannot spend one budget and dodge the other.
 */
export function checkAll(
  keys: string[],
  rule: RateLimitRule,
): RateLimitResult {
  let worst: RateLimitResult = { ok: true, remaining: rule.limit, retryAfterSeconds: 0 };

  for (const key of keys) {
    const result = checkRateLimit(key, rule);
    if (!result.ok || result.remaining < worst.remaining) worst = result;
  }

  return worst;
}

export const AUTH_LIMITS = {
  /**
   * Five attempts per five minutes, so the sixth rapid try is refused. A person
   * who has genuinely forgotten which password they used gets five goes and a
   * "Forgot your password?" link; a script gets five.
   */
  signIn: { limit: 5, windowMs: 5 * 60_000 },
  signUp: { limit: 5, windowMs: 60 * 60_000 },
  /** Reset emails are sent to a real inbox; being generous here is spam. */
  passwordReset: { limit: 4, windowMs: 60 * 60_000 },
} as const satisfies Record<string, RateLimitRule>;

/**
 * The caller's IP, as reported by the proxy in front of the app.
 *
 * These headers are trivially forged by a direct client, so this is a
 * best-effort key, never an identity — it only has to be right for traffic
 * arriving through the platform's own proxy, which overwrites them.
 */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return headers.get('x-real-ip')?.trim() || 'unknown';
}

export function tooManyAttemptsMessage(retryAfterSeconds: number): string {
  const minutes = Math.ceil(retryAfterSeconds / 60);
  return minutes <= 1
    ? 'Too many attempts. Try again in a minute.'
    : `Too many attempts. Try again in about ${minutes} minutes.`;
}
