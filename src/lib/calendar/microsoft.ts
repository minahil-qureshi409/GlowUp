import 'server-only';

import { microsoftCalendarConfig } from '@/lib/env';
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

const GRAPH = 'https://graph.microsoft.com/v1.0';

/**
 * Microsoft has no free/busy-only scope.
 *
 * `Calendars.Read` is the narrowest thing that reaches availability at all, so
 * unlike Google the *scope* cannot enforce the privacy promise — the
 * **endpoint** and the mapper have to. `getSchedule` returns availability
 * blocks and nothing else, and the `calendarView` fallback is filtered down to
 * two fields at the boundary before anything is persisted.
 *
 * `offline_access` is what yields a refresh token. `User.Read` is only for the
 * "connected as" line and for the address `getSchedule` needs as its subject.
 */
const SCOPES = [
  'openid',
  'profile',
  'email',
  'offline_access',
  'User.Read',
  'Calendars.Read',
] as const;

type MicrosoftTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
};

type ScheduleResponse = {
  value?: {
    scheduleItems?: { status?: string; start?: { dateTime?: string }; end?: { dateTime?: string } }[];
    error?: { message?: string };
  }[];
  error?: { message?: string };
};

type CalendarViewResponse = {
  value?: { start?: { dateTime?: string }; end?: { dateTime?: string }; showAs?: string }[];
  error?: { message?: string };
};

/** Graph returns naive local date-times; the timezone comes from the header. */
function graphInstant(dateTime: string | undefined, timezone: string): string | null {
  if (typeof dateTime !== 'string') return null;
  // `Prefer: outlook.timezone="UTC"` is sent on every request, so these are UTC
  // wall-clock strings with no offset. Attaching Z makes them unambiguous.
  const normalised = /(Z|[+-]\d{2}:\d{2})$/.test(dateTime) ? dateTime : `${dateTime}Z`;
  void timezone;
  return Number.isFinite(Date.parse(normalised)) ? normalised : null;
}

function config() {
  const cfg = microsoftCalendarConfig();
  if (!cfg) {
    throw new CalendarError(
      'unavailable',
      'Microsoft Outlook is not configured on this deployment. Set MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET and CALENDAR_TOKEN_KEY.',
    );
  }
  return cfg;
}

function tokenEndpoint(tenant: string) {
  return `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`;
}

async function postForm(body: Record<string, string>) {
  const { tenant } = config();
  const response = await fetchWithBackoff(tokenEndpoint(tenant), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  });

  const payload = (await response.json().catch(() => ({}))) as MicrosoftTokenResponse;

  if (!response.ok) {
    const detail = payload.error_description ?? payload.error ?? `HTTP ${response.status}`;
    if (response.status === 400 || response.status === 401) {
      throw new CalendarError('unauthorized', `Microsoft rejected the request: ${detail}`);
    }
    if (response.status === 429) {
      throw new CalendarError('rate-limited', detail, retryAfterSeconds(response));
    }
    throw new CalendarError('unavailable', `Microsoft token request failed: ${detail}`);
  }

  return payload;
}

function toTokens(payload: MicrosoftTokenResponse, fallbackRefresh: string | null): OAuthTokens {
  if (!payload.access_token) {
    throw new CalendarError('unauthorized', 'Microsoft did not return an access token.');
  }
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token ?? fallbackRefresh,
    expiresAt: payload.expires_in ? new Date(Date.now() + payload.expires_in * 1000) : null,
    scopes: payload.scope ? payload.scope.split(' ') : [...SCOPES],
  };
}

/**
 * Microsoft Outlook, registered under the existing `outlook` provider id.
 *
 * The enum in the database already had `outlook` and the UI already called it
 * "Microsoft Outlook", so the id stays as it is rather than being renamed to
 * `microsoft` — an enum rename would mean a migration and a data rewrite for a
 * label nobody sees.
 */
export const microsoftCalendarProvider: CalendarProvider = {
  id: 'outlook',
  label: 'Microsoft Outlook',
  permissionSummary:
    'GlowUp asks Microsoft only for your availability — the start and end of blocks when you are busy. It never stores event names, guests or locations, and it cannot create or edit anything in your calendar.',
  scopes: SCOPES,
  manageAccessUrl: 'https://myapps.microsoft.com',

  isConfigured() {
    return microsoftCalendarConfig() !== null;
  },

  authorizeUrl(state: string, codeChallenge: string) {
    const { clientId, redirectUri, tenant } = config();
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      response_mode: 'query',
      scope: SCOPES.join(' '),
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state,
    });
    return `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/authorize?${params.toString()}`;
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
      scope: SCOPES.join(' '),
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
      scope: SCOPES.join(' '),
    });
    return toTokens(payload, refreshToken);
  },

  async fetchBusy(
    accessToken: string,
    request: FreeBusyRequest,
    account: ProviderAccount,
  ): Promise<BusyInterval[]> {
    const subject = account.email ?? (await fetchAccount(accessToken)).email;

    if (subject) {
      const viaSchedule = await getSchedule(accessToken, request, subject);
      if (viaSchedule !== null) return viaSchedule;
    }

    // Some tenants disable getSchedule. The fallback reads the calendar view,
    // but only ever asks for three fields and keeps two of them.
    return calendarView(accessToken, request);
  },

  async revoke() {
    /*
     * Microsoft's v2.0 endpoint has no token revocation API a confidential
     * client can call for a delegated grant — `/me/revokeSignInSessions` needs
     * privileges this app deliberately does not hold.
     *
     * So disconnecting deletes every local token and every cached busy block,
     * which stops GlowUp using the grant entirely, and the UI points the user
     * at myapps.microsoft.com to remove the consent itself. Saying nothing and
     * pretending the grant was revoked would be the dishonest option.
     */
  },
};

/** Returns `null` when the tenant refuses, so the caller can fall back. */
async function getSchedule(
  accessToken: string,
  request: FreeBusyRequest,
  subject: string,
): Promise<BusyInterval[] | null> {
  const response = await fetchWithBackoff(`${GRAPH}/me/calendar/getSchedule`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Prefer: 'outlook.timezone="UTC"',
    },
    body: JSON.stringify({
      schedules: [subject],
      startTime: { dateTime: request.timeMin, timeZone: 'UTC' },
      endTime: { dateTime: request.timeMax, timeZone: 'UTC' },
      availabilityViewInterval: 30,
    }),
  });

  if (response.status === 401) {
    throw new CalendarError('unauthorized', 'Microsoft access token is no longer valid.');
  }
  if (response.status === 429) {
    throw new CalendarError(
      'rate-limited',
      'Microsoft rate-limited the availability request.',
      retryAfterSeconds(response),
    );
  }
  // 403 here usually means the tenant has getSchedule disabled, not that the
  // grant is gone — fall back rather than marking the connection broken.
  if (response.status === 403 || response.status === 404) return null;
  if (!response.ok) return null;

  const payload = (await response.json().catch(() => ({}))) as ScheduleResponse;
  const items = payload.value?.[0]?.scheduleItems;
  if (!Array.isArray(items)) return null;

  return items
    .filter((item) => item?.status !== 'free' && item?.status !== 'workingElsewhere')
    .map((item) =>
      toBusyInterval(
        graphInstant(item?.start?.dateTime, request.timezone),
        graphInstant(item?.end?.dateTime, request.timezone),
      ),
    )
    .filter((interval): interval is BusyInterval => interval !== null);
}

async function calendarView(
  accessToken: string,
  request: FreeBusyRequest,
): Promise<BusyInterval[]> {
  const params = new URLSearchParams({
    startDateTime: request.timeMin,
    endDateTime: request.timeMax,
    // Three fields requested, two kept. Subjects, bodies, organisers and
    // attendees are never asked for in the first place.
    $select: 'start,end,showAs',
    $top: '200',
  });

  const response = await fetchWithBackoff(`${GRAPH}/me/calendarView?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Prefer: 'outlook.timezone="UTC"',
    },
  });

  if (response.status === 401 || response.status === 403) {
    throw new CalendarError('unauthorized', 'Microsoft access token is no longer valid.');
  }
  if (response.status === 429) {
    throw new CalendarError(
      'rate-limited',
      'Microsoft rate-limited the calendar request.',
      retryAfterSeconds(response),
    );
  }

  const payload = (await response.json().catch(() => ({}))) as CalendarViewResponse;

  if (!response.ok) {
    throw new CalendarError(
      'unavailable',
      payload.error?.message ?? `Calendar request failed (HTTP ${response.status}).`,
    );
  }

  return (payload.value ?? [])
    .filter((item) => item?.showAs !== 'free' && item?.showAs !== 'workingElsewhere')
    .map((item) =>
      toBusyInterval(
        graphInstant(item?.start?.dateTime, request.timezone),
        graphInstant(item?.end?.dateTime, request.timezone),
      ),
    )
    .filter((interval): interval is BusyInterval => interval !== null);
}

async function fetchAccount(accessToken: string): Promise<ProviderAccount> {
  try {
    const response = await fetch(`${GRAPH}/me?$select=mail,userPrincipalName`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });
    if (!response.ok) return { email: null };
    const payload = (await response.json()) as { mail?: string; userPrincipalName?: string };
    const email = payload.mail ?? payload.userPrincipalName;
    return { email: typeof email === 'string' ? email : null };
  } catch {
    return { email: null };
  }
}
