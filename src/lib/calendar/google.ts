import 'server-only';

import { googleCalendarConfig } from '@/lib/env';
import {
  CalendarError,
  fetchWithBackoff,
  retryAfterSeconds,
  toBusyInterval,
  type BusyInterval,
  type CalendarProvider,
  type FreeBusyRequest,
  type OAuthTokens,
  type ProviderAccount,
} from '@/lib/calendar/types';

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const FREEBUSY_ENDPOINT = 'https://www.googleapis.com/calendar/v3/freeBusy';
const REVOKE_ENDPOINT = 'https://oauth2.googleapis.com/revoke';
const USERINFO_ENDPOINT = 'https://www.googleapis.com/oauth2/v3/userinfo';

/**
 * `calendar.freebusy` is the narrowest Calendar scope Google offers. It grants
 * exactly one capability: asking "is this person busy between X and Y". Event
 * titles, descriptions, attendees, locations and even calendar names are not
 * readable with it — not by this app, and not by anything that steals the token.
 *
 * It is also a *sensitive* scope rather than a *restricted* one, which means a
 * lighter verification review than `calendar.readonly` would need. That is a
 * deliberate part of the design, not an accident.
 *
 * `userinfo.email` is included only so the Calendar screen can say which
 * account is connected. Nothing else reads it.
 */
const SCOPES = [
  'https://www.googleapis.com/auth/calendar.freebusy',
  'https://www.googleapis.com/auth/userinfo.email',
] as const;

type GoogleTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
};

type GoogleFreeBusyResponse = {
  calendars?: Record<string, { busy?: { start?: string; end?: string }[]; errors?: unknown[] }>;
  error?: { message?: string; code?: number };
};

function config() {
  const cfg = googleCalendarConfig();
  if (!cfg) {
    throw new CalendarError(
      'unavailable',
      'Google Calendar is not configured on this deployment. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and CALENDAR_TOKEN_KEY.',
    );
  }
  return cfg;
}

async function postForm(body: Record<string, string>) {
  const response = await fetchWithBackoff(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  });

  const payload = (await response.json().catch(() => ({}))) as GoogleTokenResponse;

  if (!response.ok) {
    const detail = payload.error_description ?? payload.error ?? `HTTP ${response.status}`;
    if (response.status === 400 || response.status === 401) {
      throw new CalendarError('unauthorized', `Google rejected the request: ${detail}`);
    }
    if (response.status === 429) {
      throw new CalendarError('rate-limited', detail, retryAfterSeconds(response));
    }
    throw new CalendarError('unavailable', `Google token request failed: ${detail}`);
  }

  return payload;
}

function toTokens(payload: GoogleTokenResponse, fallbackRefresh: string | null): OAuthTokens {
  if (!payload.access_token) {
    throw new CalendarError('unauthorized', 'Google did not return an access token.');
  }
  return {
    accessToken: payload.access_token,
    // Google only returns a refresh token on the first consent, so an existing
    // one is carried forward across refreshes.
    refreshToken: payload.refresh_token ?? fallbackRefresh,
    expiresAt: payload.expires_in ? new Date(Date.now() + payload.expires_in * 1000) : null,
    scopes: payload.scope ? payload.scope.split(' ') : [...SCOPES],
  };
}

export const googleCalendarProvider: CalendarProvider = {
  id: 'google',
  label: 'Google Calendar',
  permissionSummary:
    'GlowUp can see when you are busy — start and end times only. It cannot see event titles, descriptions, guests or locations, and it never creates or edits events.',
  scopes: SCOPES,
  manageAccessUrl: 'https://myaccount.google.com/permissions',

  isConfigured() {
    return googleCalendarConfig() !== null;
  },

  authorizeUrl(state: string, codeChallenge: string) {
    const { clientId, redirectUri } = config();
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: SCOPES.join(' '),
      // Needed for a refresh token; without it the connection dies in an hour.
      access_type: 'offline',
      // Force the consent screen so a re-connect always yields a refresh token.
      prompt: 'consent',
      include_granted_scopes: 'false',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state,
    });
    return `${AUTH_ENDPOINT}?${params.toString()}`;
  },

  async exchangeCode(code: string, verifier: string) {
    const { clientId, clientSecret, redirectUri } = config();
    const payload = await postForm({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      code_verifier: verifier,
    });

    const tokens = toTokens(payload, null);
    const account = await fetchAccount(tokens.accessToken);
    return { tokens, account };
  },

  async refresh(refreshToken: string) {
    const { clientId, clientSecret } = config();
    const payload = await postForm({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    });
    return toTokens(payload, refreshToken);
  },

  async fetchBusy(accessToken: string, request: FreeBusyRequest): Promise<BusyInterval[]> {
    const response = await fetchWithBackoff(FREEBUSY_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        timeMin: request.timeMin,
        timeMax: request.timeMax,
        timeZone: request.timezone,
        // "primary" is the user's own calendar. Asking for a list of calendars
        // would need a broader scope, which this app does not request.
        items: [{ id: 'primary' }],
      }),
    });

    if (response.status === 401 || response.status === 403) {
      throw new CalendarError('unauthorized', 'Google access token is no longer valid.');
    }
    if (response.status === 429) {
      throw new CalendarError(
        'rate-limited',
        'Google rate-limited the free/busy request.',
        retryAfterSeconds(response),
      );
    }

    const payload = (await response.json().catch(() => ({}))) as GoogleFreeBusyResponse;

    if (!response.ok) {
      throw new CalendarError(
        'unavailable',
        payload.error?.message ?? `Free/busy request failed (HTTP ${response.status}).`,
      );
    }

    // `toBusyInterval` copies two fields and ignores everything else. Even if
    // the response grew an event summary, it could not reach the database.
    return (payload.calendars?.['primary']?.busy ?? [])
      .map((slot) => toBusyInterval(slot?.start, slot?.end))
      .filter((interval): interval is BusyInterval => interval !== null);
  },

  async revoke(tokens) {
    // Best effort: if Google is unreachable the local rows still get deleted.
    // Revoking the refresh token invalidates the whole grant, so it is tried
    // first; the access token is the fallback when there is no refresh token.
    const token = tokens.refreshToken ?? tokens.accessToken;
    try {
      await fetch(REVOKE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token }).toString(),
        cache: 'no-store',
      });
    } catch {
      // Intentionally swallowed.
    }
  },
};

async function fetchAccount(accessToken: string): Promise<ProviderAccount> {
  try {
    const response = await fetch(USERINFO_ENDPOINT, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });
    if (!response.ok) return { email: null };
    const payload = (await response.json()) as { email?: string };
    return { email: typeof payload.email === 'string' ? payload.email : null };
  } catch {
    return { email: null };
  }
}
