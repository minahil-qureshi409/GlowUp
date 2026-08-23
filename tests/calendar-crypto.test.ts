import { beforeAll, describe, expect, it } from 'vitest';

/**
 * OAuth token storage.
 *
 * RLS already keeps one user out of another's tokens — `calendar_credentials`
 * has RLS on, zero policies and revoked grants, so no client role reaches it at
 * all. This covers the other threat: a database dump, a leaked backup, or
 * anything holding the service-role key finding a column of live Google refresh
 * tokens in the clear.
 */

const KEY = '5f4dcc3b5aa765d61d8327deb882cf995f4dcc3b5aa765d61d8327deb882cf99';

let encryptToken: typeof import('@/lib/calendar/crypto').encryptToken;
let decryptToken: typeof import('@/lib/calendar/crypto').decryptToken;
let isEncrypted: typeof import('@/lib/calendar/crypto').isEncrypted;
let signState: typeof import('@/lib/calendar/crypto').signState;
let verifyState: typeof import('@/lib/calendar/crypto').verifyState;
let newNonce: typeof import('@/lib/calendar/crypto').newNonce;
let createPkcePair: typeof import('@/lib/calendar/crypto').createPkcePair;

beforeAll(async () => {
  process.env.CALENDAR_TOKEN_KEY = KEY;
  // Imported after the key is in place: the module reads it on first use.
  const mod = await import('@/lib/calendar/crypto');
  ({ encryptToken, decryptToken, isEncrypted, signState, verifyState, newNonce, createPkcePair } =
    mod);
});

const SAMPLE_REFRESH_TOKEN = '1//09xVeryLongGoogleRefreshTokenValue_abcdefg-hijklmnop';

describe('token encryption', () => {
  it('round-trips', () => {
    const envelope = encryptToken(SAMPLE_REFRESH_TOKEN);
    expect(decryptToken(envelope)).toBe(SAMPLE_REFRESH_TOKEN);
  });

  it('stores ciphertext, not a readable string', () => {
    const envelope = encryptToken(SAMPLE_REFRESH_TOKEN);

    expect(envelope).not.toContain(SAMPLE_REFRESH_TOKEN);
    expect(envelope).not.toContain('1//09xVeryLong');
    expect(isEncrypted(envelope)).toBe(true);
    expect(envelope.startsWith('v1.')).toBe(true);
    expect(envelope.split('.')).toHaveLength(4);
  });

  it('uses a fresh IV per row, so identical tokens do not look identical', () => {
    const first = encryptToken(SAMPLE_REFRESH_TOKEN);
    const second = encryptToken(SAMPLE_REFRESH_TOKEN);

    expect(first).not.toBe(second);
    expect(decryptToken(first)).toBe(decryptToken(second));
  });

  it('refuses tampered ciphertext rather than returning garbage', () => {
    const envelope = encryptToken(SAMPLE_REFRESH_TOKEN);
    const parts = envelope.split('.');

    // Flipped in the decoded *bytes*, not in the base64 text: the final
    // base64url character can carry unused padding bits, so editing it does not
    // reliably change the plaintext and would make this test flaky.
    const bytes = Buffer.from(parts[3] ?? '', 'base64url');
    bytes[0] = (bytes[0] ?? 0) ^ 0xff;
    const tampered = [parts[0], parts[1], parts[2], bytes.toString('base64url')].join('.');

    // GCM's auth tag is what catches it.
    expect(decryptToken(tampered)).toBeNull();
  });

  it('refuses a swapped auth tag or IV', () => {
    const a = encryptToken(SAMPLE_REFRESH_TOKEN).split('.');
    const b = encryptToken('a different token entirely').split('.');

    expect(decryptToken([a[0], a[1], b[2], a[3]].join('.'))).toBeNull();
    expect(decryptToken([a[0], b[1], a[2], a[3]].join('.'))).toBeNull();
  });

  it('returns null for anything that is not an envelope', () => {
    expect(decryptToken(null)).toBeNull();
    expect(decryptToken(undefined)).toBeNull();
    expect(decryptToken('')).toBeNull();
    expect(decryptToken('plaintext-token')).toBeNull();
    expect(decryptToken('v2.a.b.c')).toBeNull();
    expect(isEncrypted('plaintext-token')).toBe(false);
  });

  it('handles empty and unicode payloads', () => {
    expect(decryptToken(encryptToken(''))).toBe('');
    expect(decryptToken(encryptToken('токен–✨'))).toBe('токен–✨');
  });
});

describe('OAuth state', () => {
  function state(overrides: Partial<{ provider: string; userId: string; exp: number }> = {}) {
    return {
      provider: 'google',
      userId: '11111111-2222-3333-4444-555555555555',
      nonce: newNonce(),
      exp: Math.floor(Date.now() / 1000) + 600,
      ...overrides,
    };
  }

  it('round-trips a valid state', () => {
    const original = state();
    const verified = verifyState(signState(original));

    expect(verified).not.toBeNull();
    expect(verified?.provider).toBe('google');
    expect(verified?.userId).toBe(original.userId);
    expect(verified?.nonce).toBe(original.nonce);
  });

  it('rejects a tampered payload', () => {
    const token = signState(state());
    const [payload, signature] = token.split('.');

    // Re-encode the payload with a different user id, keeping the signature.
    const forged = Buffer.from(
      JSON.stringify({ ...state({ userId: 'attacker' }) }),
      'utf8',
    ).toString('base64url');

    expect(verifyState(`${forged}.${signature}`)).toBeNull();
    expect(verifyState(`${payload}.notasignature`)).toBeNull();
    expect(verifyState('garbage')).toBeNull();
    expect(verifyState(null)).toBeNull();
  });

  it('rejects an expired state', () => {
    const expired = signState(state({ exp: Math.floor(Date.now() / 1000) - 1 }));
    expect(verifyState(expired)).toBeNull();
  });

  it('mints a different nonce every time', () => {
    const nonces = new Set(Array.from({ length: 50 }, () => newNonce()));
    expect(nonces.size).toBe(50);
    expect(newNonce().length).toBeGreaterThanOrEqual(16);
  });
});

describe('PKCE', () => {
  it('produces a verifier that never equals its challenge', () => {
    const { verifier, challenge } = createPkcePair();

    expect(verifier).not.toBe(challenge);
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    // base64url only: no +, / or = to be mangled in a query string.
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('is a real S256 challenge', async () => {
    const { createHash } = await import('node:crypto');
    const { verifier, challenge } = createPkcePair();

    expect(createHash('sha256').update(verifier).digest('base64url')).toBe(challenge);
  });

  it('is different on every call', () => {
    const a = createPkcePair();
    const b = createPkcePair();
    expect(a.verifier).not.toBe(b.verifier);
    expect(a.challenge).not.toBe(b.challenge);
  });
});
