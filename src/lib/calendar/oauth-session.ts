import 'server-only';

import { cookies } from 'next/headers';

import { newNonce, signState, verifyState, type OAuthState } from '@/lib/calendar/crypto';

/**
 * The short-lived server-side half of an OAuth round trip.
 *
 * `state` is signed, single-use, tied to the session and valid for ten minutes.
 * Three properties, three mechanisms:
 *
 *   - **tied to the session** — the signed payload carries the user id, and the
 *     callback checks it against whoever is actually signed in. Without this,
 *     an attacker can complete a flow in a victim's browser and end up with
 *     *their* calendar attached to the victim's account.
 *   - **single-use** — the nonce also lives in an httpOnly cookie which the
 *     callback deletes before doing anything else, so a replayed callback URL
 *     finds nothing to match.
 *   - **short-lived** — a ten-minute expiry inside the signature, so an old
 *     link is refused even if the cookie somehow survives.
 *
 * The PKCE verifier rides in the same cookie. It is httpOnly and never leaves
 * the server; only its SHA-256 challenge goes to the provider.
 */

const COOKIE = 'glowup_oauth';
const TTL_SECONDS = 600;

export type OAuthHandshake = { nonce: string; verifier: string; provider: string };

export async function beginHandshake(
  provider: string,
  userId: string,
  verifier: string,
): Promise<string> {
  const nonce = newNonce();
  const state: OAuthState = {
    provider,
    userId,
    nonce,
    exp: Math.floor(Date.now() / 1000) + TTL_SECONDS,
  };

  const store = await cookies();
  store.set(COOKIE, JSON.stringify({ nonce, verifier, provider } satisfies OAuthHandshake), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/calendar',
    maxAge: TTL_SECONDS,
  });

  return signState(state);
}

export type HandshakeResult =
  | { ok: true; verifier: string }
  | { ok: false; reason: 'invalid_state' | 'expired_state' };

/**
 * Consumes the handshake. Always clears the cookie first, whatever the outcome:
 * a failed attempt must not leave a reusable nonce behind.
 */
export async function completeHandshake(
  provider: string,
  userId: string,
  stateToken: string | null,
): Promise<HandshakeResult> {
  const store = await cookies();
  const raw = store.get(COOKIE)?.value;
  store.delete(COOKIE);

  if (!raw) return { ok: false, reason: 'expired_state' };

  const state = verifyState(stateToken);
  if (!state) return { ok: false, reason: 'invalid_state' };

  let stored: OAuthHandshake;
  try {
    stored = JSON.parse(raw) as OAuthHandshake;
  } catch {
    return { ok: false, reason: 'invalid_state' };
  }

  if (
    state.nonce !== stored.nonce ||
    state.provider !== stored.provider ||
    state.provider !== provider ||
    state.userId !== userId ||
    typeof stored.verifier !== 'string' ||
    stored.verifier.length < 32
  ) {
    return { ok: false, reason: 'invalid_state' };
  }

  return { ok: true, verifier: stored.verifier };
}
