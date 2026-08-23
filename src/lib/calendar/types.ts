import type { Enums } from '@/lib/db/database.types';

/**
 * Calendar provider contract.
 *
 * Google and Microsoft implement it; Apple (CalDAV) would slot in behind the
 * same shape. Nothing outside `lib/calendar` knows which provider is in play —
 * the routes, services and UI all address providers by id.
 *
 * The interface intentionally exposes **only free/busy**. There is no method to
 * read event titles, descriptions, attendees or locations, so no future caller
 * can accidentally start collecting them. The privacy promise on the Calendar
 * screen is enforced by the type, not by a code review.
 */

export type BusyInterval = {
  /** ISO-8601 instant. */
  start: string;
  end: string;
};

export type FreeBusyRequest = {
  timeMin: string;
  timeMax: string;
  timezone: string;
};

export type OAuthTokens = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  scopes: string[];
};

export type ProviderAccount = {
  email: string | null;
};

export type CalendarProviderError = {
  code: 'unauthorized' | 'rate-limited' | 'unavailable' | 'unknown';
  message: string;
};

export interface CalendarProvider {
  readonly id: Enums<'calendar_provider'>;
  readonly label: string;
  /** Human-readable description of exactly what the app will be able to see. */
  readonly permissionSummary: string;
  readonly scopes: readonly string[];

  /** Whether the deployment has credentials configured for this provider. */
  isConfigured(): boolean;

  /**
   * URL to send the user to.
   *
   * `state` is a signed, single-use nonce; `codeChallenge` is the PKCE
   * challenge whose verifier never leaves the server.
   */
  authorizeUrl(state: string, codeChallenge: string): string;

  exchangeCode(
    code: string,
    verifier: string,
  ): Promise<{ tokens: OAuthTokens; account: ProviderAccount }>;

  refresh(refreshToken: string): Promise<OAuthTokens>;

  /** Busy intervals only. Never returns event details. */
  fetchBusy(
    accessToken: string,
    request: FreeBusyRequest,
    account: ProviderAccount,
  ): Promise<BusyInterval[]>;

  /**
   * Best-effort revocation at the provider. Local rows are removed regardless,
   * so "Disconnect" always disconnects from the user's side.
   */
  revoke(tokens: { accessToken: string; refreshToken: string | null }): Promise<void>;

  /**
   * Where to remove the app's access from the provider's own account page.
   * Shown after disconnecting where the provider offers no revocation API.
   */
  readonly manageAccessUrl: string | null;
}

export class CalendarError extends Error {
  readonly code: CalendarProviderError['code'];
  /** Seconds the provider asked us to wait, from `Retry-After`. */
  readonly retryAfterSeconds: number | null;

  constructor(
    code: CalendarProviderError['code'],
    message: string,
    retryAfterSeconds: number | null = null,
  ) {
    super(message);
    this.name = 'CalendarError';
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/**
 * The only way a busy block is allowed to be constructed.
 *
 * Field by field, never a spread. A provider that starts returning subjects,
 * organisers or attendee lists in the same object cannot leak them into the
 * database through here, because nothing but `start` and `end` is copied.
 */
export function toBusyInterval(start: unknown, end: unknown): BusyInterval | null {
  if (typeof start !== 'string' || typeof end !== 'string') return null;

  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return null;

  return { start: new Date(startMs).toISOString(), end: new Date(endMs).toISOString() };
}

/**
 * Fetch with a bounded retry.
 *
 * `429` and `5xx` are transient by definition, and hammering either one is how
 * a quota gets suspended. Honours `Retry-After` when the provider sends it, and
 * backs off exponentially when it does not.
 */
export async function fetchWithBackoff(
  input: string,
  init: RequestInit,
  attempts = 3,
): Promise<Response> {
  let lastResponse: Response | null = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const response = await fetch(input, { ...init, cache: 'no-store' });

    if (response.status !== 429 && response.status < 500) return response;

    lastResponse = response;
    if (attempt === attempts - 1) break;

    const retryAfter = Number(response.headers.get('retry-after'));
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
      ? Math.min(retryAfter * 1000, 10_000)
      : Math.min(500 * 2 ** attempt, 4_000);

    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  return lastResponse as Response;
}

export function retryAfterSeconds(response: Response): number | null {
  const value = Number(response.headers.get('retry-after'));
  return Number.isFinite(value) && value > 0 ? value : null;
}
