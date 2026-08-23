import 'server-only';

import type { SupabaseServerClient } from '@/lib/supabase/server';
import type { Enums, Tables } from '@/lib/db/database.types';
import { createAdminClient } from '@/lib/supabase/admin';
import { getProvider } from '@/lib/calendar/registry';
import { decryptToken, encryptToken } from '@/lib/calendar/crypto';
import {
  CalendarError,
  type BusyInterval,
  type OAuthTokens,
  type ProviderAccount,
} from '@/lib/calendar/types';
import { getUserToday, toUserDate, zonedNow, type DateKey } from '@/lib/date';
import type { BusyBlock } from '@/lib/domain/planner';

export type CalendarConnection = Tables<'calendar_connections'>;

/** How long the app holds someone's availability. Stated on the UI; enforced here. */
export const SYNC_WINDOW_DAYS = 14;

/** Refresh this far before expiry so a token cannot die mid-request. */
const REFRESH_MARGIN_MS = 5 * 60_000;

export async function getConnections(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<CalendarConnection[]> {
  const { data, error } = await supabase
    .from('calendar_connections')
    .select('*')
    .eq('user_id', userId)
    .order('provider');

  if (error) throw error;
  return data ?? [];
}

/**
 * Busy blocks for a day, as local decimal hours.
 *
 * Reads the cached `calendar_event_metadata` rows rather than hitting the
 * provider — the cache holds only start/end/busy, never event contents, and it
 * keeps the dashboard fast and the API quota small.
 */
export async function getBusyBlocksForDate(
  supabase: SupabaseServerClient,
  userId: string,
  date: DateKey,
  timezone: string,
): Promise<BusyBlock[]> {
  const { data, error } = await supabase
    .from('calendar_event_metadata')
    .select('starts_at, ends_at, is_busy')
    .eq('user_id', userId)
    .eq('day', date)
    .eq('is_busy', true);

  if (error) throw error;

  return (data ?? [])
    .map((row) => toBusyBlock(row.starts_at, row.ends_at, timezone))
    .filter((block): block is BusyBlock => block !== null);
}

export async function getBusyBlocksInRange(
  supabase: SupabaseServerClient,
  userId: string,
  from: DateKey,
  to: DateKey,
  timezone: string,
): Promise<Map<DateKey, BusyBlock[]>> {
  const { data, error } = await supabase
    .from('calendar_event_metadata')
    .select('day, starts_at, ends_at, is_busy')
    .eq('user_id', userId)
    .eq('is_busy', true)
    .gte('day', from)
    .lte('day', to);

  if (error) throw error;

  const byDay = new Map<DateKey, BusyBlock[]>();
  for (const row of data ?? []) {
    const block = toBusyBlock(row.starts_at, row.ends_at, timezone);
    if (!block) continue;
    const bucket = byDay.get(row.day) ?? [];
    bucket.push(block);
    byDay.set(row.day, bucket);
  }
  return byDay;
}

function toBusyBlock(startsAt: string, endsAt: string, timezone: string): BusyBlock | null {
  const start = zonedNow(timezone, new Date(startsAt));
  const end = zonedNow(timezone, new Date(endsAt));
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;

  const startHour = start.getHours() + start.getMinutes() / 60;
  // A block that runs past midnight is clamped to the end of the day rather
  // than wrapping — the planner only ever reasons about one day at a time.
  const endHour =
    end.toDateString() === start.toDateString() ? end.getHours() + end.getMinutes() / 60 : 24;

  if (endHour <= startHour) return null;
  return { startHour, endHour };
}

// ── token storage ───────────────────────────────────────────────────────────

type StoredTokens = {
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: Date | null;
};

/**
 * Writes a token set.
 *
 * Both tokens go in encrypted, and the plaintext columns are explicitly
 * nulled — a row that gets rewritten after an upgrade must not leave its old
 * cleartext behind.
 */
export async function storeTokens(
  admin: ReturnType<typeof createAdminClient>,
  connectionId: string,
  userId: string,
  tokens: OAuthTokens,
) {
  const { error } = await admin.from('calendar_credentials').upsert(
    {
      connection_id: connectionId,
      user_id: userId,
      encrypted_access_token: encryptToken(tokens.accessToken),
      encrypted_refresh_token: tokens.refreshToken ? encryptToken(tokens.refreshToken) : null,
      access_token: null,
      refresh_token: null,
      token_expires_at: tokens.expiresAt?.toISOString() ?? null,
      token_version: 1,
    },
    { onConflict: 'connection_id' },
  );

  if (error) throw error;
}

/**
 * Reads a token set.
 *
 * Falls back to the pre-encryption plaintext columns so a connection made
 * before the change keeps working; the next refresh rewrites it encrypted.
 */
function readTokens(row: Tables<'calendar_credentials'>): StoredTokens {
  return {
    accessToken: decryptToken(row.encrypted_access_token) ?? row.access_token ?? null,
    refreshToken: decryptToken(row.encrypted_refresh_token) ?? row.refresh_token ?? null,
    expiresAt: row.token_expires_at ? new Date(row.token_expires_at) : null,
  };
}

// ── sync ────────────────────────────────────────────────────────────────────

/**
 * Refreshes the busy cache from the provider.
 *
 * Runs with the service-role client because it must read the OAuth token, which
 * no client role can see. Every statement is still scoped by `user_id` by hand,
 * since RLS is not doing it here.
 */
export async function syncBusyWindow(
  userId: string,
  provider: Enums<'calendar_provider'>,
  range: { from: Date; to: Date },
  timezone: string,
): Promise<{ synced: number }> {
  const admin = createAdminClient();

  const { data: connection, error: connectionError } = await admin
    .from('calendar_connections')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', provider)
    .maybeSingle();

  if (connectionError) throw connectionError;
  if (!connection) throw new CalendarError('unauthorized', 'No calendar connection found.');

  const { data: credentialRow, error: credentialsError } = await admin
    .from('calendar_credentials')
    .select('*')
    .eq('connection_id', connection.id)
    .maybeSingle();

  if (credentialsError) throw credentialsError;
  if (!credentialRow) {
    await markConnectionError(
      userId,
      connection.id,
      new Error('Calendar credentials are missing. Reconnect to fix this.'),
      'expired',
    );
    throw new CalendarError('unauthorized', 'Calendar credentials are missing.');
  }

  const impl = getProvider(provider);
  const stored = readTokens(credentialRow);
  const account: ProviderAccount = { email: connection.account_email ?? null };

  /** Trades the refresh token for a new access token, and persists the result. */
  async function refreshNow(): Promise<string> {
    if (!stored.refreshToken) {
      throw new CalendarError(
        'unauthorized',
        'This connection has no refresh token. Reconnect to restore it.',
      );
    }
    const refreshed = await impl.refresh(stored.refreshToken);
    await storeTokens(admin, connection!.id, userId, {
      ...refreshed,
      refreshToken: refreshed.refreshToken ?? stored.refreshToken,
    });
    stored.accessToken = refreshed.accessToken;
    stored.refreshToken = refreshed.refreshToken ?? stored.refreshToken;
    return refreshed.accessToken;
  }

  // Refresh five minutes early, and refresh unconditionally if the stored
  // access token could not be decrypted (a rotated key, or a truncated row).
  const expired =
    stored.accessToken === null ||
    (stored.expiresAt !== null && stored.expiresAt.getTime() - REFRESH_MARGIN_MS < Date.now());

  let accessToken = stored.accessToken ?? '';

  if (expired) {
    try {
      accessToken = await refreshNow();
    } catch (error) {
      await markConnectionError(userId, connection.id, error, 'expired');
      throw error;
    }
  }

  let busy: BusyInterval[];
  try {
    busy = await impl.fetchBusy(
      accessToken,
      { timeMin: range.from.toISOString(), timeMax: range.to.toISOString(), timezone },
      account,
    );
  } catch (error) {
    // A 401 on a token we believed was live means it was revoked or rotated
    // upstream. Refresh once; if that also fails the grant is genuinely gone
    // and the UI must say so rather than failing silently forever.
    if (error instanceof CalendarError && error.code === 'unauthorized' && !expired) {
      try {
        accessToken = await refreshNow();
        busy = await impl.fetchBusy(
          accessToken,
          { timeMin: range.from.toISOString(), timeMax: range.to.toISOString(), timezone },
          account,
        );
      } catch (retryError) {
        await markConnectionError(
          userId,
          connection.id,
          new Error(
            'Access was revoked or has expired. Reconnect to start seeing your busy times again.',
          ),
          'expired',
        );
        throw retryError;
      }
    } else {
      await markConnectionError(
        userId,
        connection.id,
        error,
        error instanceof CalendarError && error.code === 'unauthorized' ? 'expired' : 'error',
      );
      throw error;
    }
  }

  // Window boundaries are the *user's* local days, not the server's.
  const fromDay = toUserDate(range.from, timezone);
  const toDay = toUserDate(range.to, timezone);
  const today = getUserToday(timezone);

  // Retention is enforced by construction, not by a policy someone has to
  // remember: everything before today goes on every single sync.
  await admin
    .from('calendar_event_metadata')
    .delete()
    .eq('user_id', userId)
    .eq('connection_id', connection.id)
    .lt('day', today);

  // Replace the window wholesale: a deleted meeting must disappear from the
  // cache, and there is no per-event id to diff against with free/busy data.
  await admin
    .from('calendar_event_metadata')
    .delete()
    .eq('user_id', userId)
    .eq('connection_id', connection.id)
    .gte('day', fromDay)
    .lte('day', toDay);

  // The mapper constructs the row field by field. Nothing is spread from the
  // provider response, so a future API change cannot smuggle a subject line,
  // an organiser or an attendee list into the database.
  const rows = busy
    .map((interval) => ({
      user_id: userId,
      connection_id: connection.id,
      day: toUserDate(interval.start, timezone),
      starts_at: interval.start,
      ends_at: interval.end,
      is_busy: true,
    }))
    // Anything the provider returned outside the requested window is dropped
    // rather than stored: the stated retention is now → +14 days, full stop.
    .filter((row) => row.day >= today && row.day <= toDay);

  if (rows.length > 0) {
    const { error: insertError } = await admin.from('calendar_event_metadata').insert(rows);
    if (insertError) throw insertError;
  }

  await admin
    .from('calendar_connections')
    .update({ status: 'connected', last_synced_at: new Date().toISOString(), last_error: null })
    .eq('id', connection.id);

  return { synced: rows.length };
}

async function markConnectionError(
  userId: string,
  connectionId: string,
  error: unknown,
  status: Enums<'calendar_status'>,
) {
  const admin = createAdminClient();
  await admin
    .from('calendar_connections')
    .update({
      status,
      last_error: error instanceof Error ? error.message.slice(0, 300) : 'Unknown error',
    })
    .eq('id', connectionId)
    .eq('user_id', userId);
}

/**
 * Removes a connection and everything derived from it.
 *
 * Token revocation at the provider is attempted first, but a failure there
 * never blocks local deletion — "Disconnect" must always disconnect.
 */
export async function disconnectCalendar(
  userId: string,
  provider: Enums<'calendar_provider'>,
): Promise<void> {
  const admin = createAdminClient();

  const { data: connection } = await admin
    .from('calendar_connections')
    .select('id')
    .eq('user_id', userId)
    .eq('provider', provider)
    .maybeSingle();

  if (!connection) return;

  const { data: credentialRow } = await admin
    .from('calendar_credentials')
    .select('*')
    .eq('connection_id', connection.id)
    .maybeSingle();

  if (credentialRow) {
    const stored = readTokens(credentialRow);
    if (stored.accessToken || stored.refreshToken) {
      try {
        await getProvider(provider).revoke({
          accessToken: stored.accessToken ?? '',
          refreshToken: stored.refreshToken,
        });
      } catch {
        // Best effort only.
      }
    }
  }

  // Explicit deletes rather than trusting the cascade: this is the one place
  // the app promises "nothing is left behind", and it should be readable as
  // such rather than inferred from a foreign key.
  await admin.from('calendar_event_metadata').delete().eq('user_id', userId).eq('connection_id', connection.id);
  await admin.from('calendar_credentials').delete().eq('connection_id', connection.id);
  await admin.from('calendar_connections').delete().eq('id', connection.id).eq('user_id', userId);
}
