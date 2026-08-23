import 'server-only';

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

import { serverEnv } from '@/lib/env';

/**
 * Encryption for OAuth tokens.
 *
 * RLS keeps one user out of another user's tokens. This is for the other
 * threat: a database dump, a leaked backup, an over-broad read by something
 * with the service-role key. A `refresh_token` column full of live Google
 * credentials is a much worse thing to lose than a table of weigh-ins.
 *
 * AES-256-GCM with a fresh 12-byte IV per row. The auth tag is stored with the
 * ciphertext, so tampering fails loudly at decrypt rather than yielding
 * plausible garbage. The key never goes near the database.
 *
 * Envelope: `v1.<iv>.<tag>.<ciphertext>`, each part base64url.
 */

const VERSION = 'v1';
const IV_BYTES = 12;
const KEY_BYTES = 32;

let cachedKey: Buffer | null = null;

/**
 * Accepts 64 hex characters or 32 bytes of base64.
 *
 * Generate one with: `openssl rand -hex 32`
 */
function parseKey(raw: string): Buffer {
  const trimmed = raw.trim();

  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) return Buffer.from(trimmed, 'hex');

  const decoded = Buffer.from(trimmed, 'base64');
  if (decoded.length === KEY_BYTES) return decoded;

  throw new Error(
    'CALENDAR_TOKEN_KEY must be 32 bytes: 64 hex characters or base64. Generate one with `openssl rand -hex 32`.',
  );
}

function key(): Buffer {
  if (cachedKey) return cachedKey;

  const { CALENDAR_TOKEN_KEY } = serverEnv();
  if (!CALENDAR_TOKEN_KEY) {
    throw new Error(
      'CALENDAR_TOKEN_KEY is not set. Calendar connections are disabled without it, because storing OAuth refresh tokens in plaintext is not an acceptable fallback.',
    );
  }

  cachedKey = parseKey(CALENDAR_TOKEN_KEY);
  return cachedKey;
}

function b64(buffer: Buffer): string {
  return buffer.toString('base64url');
}

export function encryptToken(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return [VERSION, b64(iv), b64(cipher.getAuthTag()), b64(ciphertext)].join('.');
}

/**
 * Returns `null` rather than throwing on a value that will not decrypt.
 *
 * A rotated key, a truncated column or a row written before encryption existed
 * should surface as "this connection needs re-authorising" in the UI, not as a
 * 500 on the dashboard.
 */
export function decryptToken(envelope: string | null | undefined): string | null {
  if (!envelope) return null;

  const parts = envelope.split('.');
  if (parts.length !== 4 || parts[0] !== VERSION) return null;

  const [, ivPart, tagPart, ctPart] = parts;
  // `ctPart` is checked against undefined rather than for truthiness: an empty
  // string is a valid ciphertext (of an empty plaintext), and rejecting it here
  // would make a well-formed envelope look corrupt.
  if (!ivPart || !tagPart || ctPart === undefined) return null;

  try {
    const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(ivPart, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(ctPart, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    return null;
  }
}

/** True for a value this module produced — used to spot un-migrated rows. */
export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(`${VERSION}.`) && value.split('.').length === 4;
}

// ── OAuth state signing ─────────────────────────────────────────────────────

/**
 * `state` is signed as well as stored in an httpOnly cookie.
 *
 * The cookie is what makes it single-use and session-bound; the signature makes
 * the value echoed through the provider tamper-evident on its own, so a
 * mismatched or edited state is rejected before anything is looked up.
 */
export type OAuthState = {
  provider: string;
  userId: string;
  nonce: string;
  /** Unix seconds. */
  exp: number;
};

function sign(payload: string): string {
  return createHmac('sha256', key()).update(payload).digest('base64url');
}

export function signState(state: OAuthState): string {
  const payload = b64(Buffer.from(JSON.stringify(state), 'utf8'));
  return `${payload}.${sign(payload)}`;
}

export function verifyState(token: string | null | undefined): OAuthState | null {
  if (!token) return null;

  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;

  const expected = Buffer.from(sign(payload), 'utf8');
  const actual = Buffer.from(signature, 'utf8');
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as OAuthState;
    if (typeof parsed.exp !== 'number' || parsed.exp * 1000 < Date.now()) return null;
    if (typeof parsed.provider !== 'string' || typeof parsed.userId !== 'string') return null;
    if (typeof parsed.nonce !== 'string' || parsed.nonce.length < 16) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function newNonce(): string {
  return randomBytes(24).toString('base64url');
}

// ── PKCE ────────────────────────────────────────────────────────────────────

/**
 * Authorization Code + PKCE.
 *
 * The verifier stays in an httpOnly cookie and never leaves the server; only
 * its SHA-256 challenge goes to the provider. An authorization code
 * intercepted in transit is worthless without it.
 */
export function createPkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(48).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}
