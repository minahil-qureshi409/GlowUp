import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AUTH_LIMITS,
  checkAll,
  checkRateLimit,
  clientIp,
  resetRateLimit,
  tooManyAttemptsMessage,
} from '@/lib/rate-limit';

/**
 * Sign-in had no throttle of its own: an unlimited number of guesses could be
 * made against one address as fast as the network allowed, and Supabase's
 * project-wide limits are generous enough that a targeted run stays inside
 * them.
 */

let counter = 0;
/** A fresh key per test — the limiter's map is module state. */
function freshKey(name: string) {
  counter += 1;
  return `${name}:${counter}`;
}

beforeEach(() => {
  vi.useRealTimers();
});

describe('checkRateLimit', () => {
  it('allows exactly `limit` attempts and refuses the next one', () => {
    const key = freshKey('basic');
    const rule = { limit: 3, windowMs: 60_000 };

    expect(checkRateLimit(key, rule).ok).toBe(true);
    expect(checkRateLimit(key, rule).ok).toBe(true);
    expect(checkRateLimit(key, rule).ok).toBe(true);

    const refused = checkRateLimit(key, rule);
    expect(refused.ok).toBe(false);
    expect(refused.remaining).toBe(0);
    expect(refused.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('counts down the remaining attempts', () => {
    const key = freshKey('remaining');
    const rule = { limit: 3, windowMs: 60_000 };

    expect(checkRateLimit(key, rule).remaining).toBe(2);
    expect(checkRateLimit(key, rule).remaining).toBe(1);
    expect(checkRateLimit(key, rule).remaining).toBe(0);
  });

  it('starts a fresh window once the old one has passed', () => {
    vi.useFakeTimers();
    const key = freshKey('window');
    const rule = { limit: 2, windowMs: 1_000 };

    expect(checkRateLimit(key, rule).ok).toBe(true);
    expect(checkRateLimit(key, rule).ok).toBe(true);
    expect(checkRateLimit(key, rule).ok).toBe(false);

    vi.advanceTimersByTime(1_100);
    expect(checkRateLimit(key, rule).ok).toBe(true);
    vi.useRealTimers();
  });

  it('keeps separate budgets per key', () => {
    const a = freshKey('a');
    const b = freshKey('b');
    const rule = { limit: 1, windowMs: 60_000 };

    expect(checkRateLimit(a, rule).ok).toBe(true);
    expect(checkRateLimit(a, rule).ok).toBe(false);
    expect(checkRateLimit(b, rule).ok).toBe(true);
  });

  it('clears a budget on reset, so a correct password un-throttles you', () => {
    const key = freshKey('reset');
    const rule = { limit: 1, windowMs: 60_000 };

    expect(checkRateLimit(key, rule).ok).toBe(true);
    expect(checkRateLimit(key, rule).ok).toBe(false);

    resetRateLimit(key);
    expect(checkRateLimit(key, rule).ok).toBe(true);
  });
});

describe('sign-in limit', () => {
  it('refuses the sixth rapid attempt from one IP', () => {
    const ip = freshKey('signin:ip');
    const results = Array.from({ length: 6 }, (_, index) =>
      checkAll([`${ip}`, `signin:email:${index}@example.com`], AUTH_LIMITS.signIn),
    );

    expect(results.slice(0, 5).every((result) => result.ok)).toBe(true);
    expect(results[5]?.ok).toBe(false);
  });

  it('refuses a distributed run against one email', () => {
    // Six different IPs, one address: the per-email key is what catches this.
    const email = freshKey('signin:email');
    const results = Array.from({ length: 6 }, (_, index) =>
      checkAll([`signin:ip:198.51.100.${index}:${email}`, email], AUTH_LIMITS.signIn),
    );

    expect(results.slice(0, 5).every((result) => result.ok)).toBe(true);
    expect(results[5]?.ok).toBe(false);
  });

  it('consumes every key on every call, so one budget cannot shield another', () => {
    const ip = freshKey('both:ip');
    const email = freshKey('both:email');

    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(checkAll([ip, email], AUTH_LIMITS.signIn).ok).toBe(true);
    }

    // Both keys are now spent, so either alone is refused too.
    expect(checkRateLimit(ip, AUTH_LIMITS.signIn).ok).toBe(false);
    expect(checkRateLimit(email, AUTH_LIMITS.signIn).ok).toBe(false);
  });
});

describe('clientIp', () => {
  it('takes the first hop of x-forwarded-for', () => {
    const headers = new Headers({ 'x-forwarded-for': '203.0.113.7, 70.41.3.18, 150.172.238.178' });
    expect(clientIp(headers)).toBe('203.0.113.7');
  });

  it('falls back to x-real-ip, then to a constant', () => {
    expect(clientIp(new Headers({ 'x-real-ip': '203.0.113.9' }))).toBe('203.0.113.9');
    expect(clientIp(new Headers())).toBe('unknown');
  });
});

describe('tooManyAttemptsMessage', () => {
  it('says something a person can act on', () => {
    expect(tooManyAttemptsMessage(30)).toBe('Too many attempts. Try again in a minute.');
    expect(tooManyAttemptsMessage(240)).toBe('Too many attempts. Try again in about 4 minutes.');
  });
});
