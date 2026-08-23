import { NextResponse, type NextRequest } from 'next/server';

import { createAdminClient } from '@/lib/supabase/admin';
import { serverEnv } from '@/lib/env';
import { syncBusyWindow, SYNC_WINDOW_DAYS } from '@/services/calendar';
import { isProviderId } from '@/lib/calendar/registry';

/**
 * The scheduled half of calendar sync.
 *
 * The in-app Refresh button covers "I just added a meeting"; this covers the
 * rest, and it is also what enforces retention on a connection nobody has
 * opened in a fortnight — every run deletes blocks before today, so an
 * abandoned connection does not sit on stale availability forever.
 *
 * Point a cron at it (Vercel Cron, GitHub Actions, anything) roughly hourly:
 *
 *   curl -H "Authorization: Bearer $CALENDAR_SYNC_SECRET" \
 *        https://your-app/api/calendar/sync
 *
 * Without `CALENDAR_SYNC_SECRET` set the endpoint refuses every request rather
 * than defaulting open — an unauthenticated sync trigger is a free way to burn
 * somebody's API quota.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const { CALENDAR_SYNC_SECRET } = serverEnv();

  if (!CALENDAR_SYNC_SECRET) {
    return NextResponse.json({ error: 'Sync endpoint is not configured.' }, { status: 503 });
  }

  const authorization = request.headers.get('authorization');
  if (authorization !== `Bearer ${CALENDAR_SYNC_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const admin = createAdminClient();

  // `expired` connections are skipped: they need the user to re-authorise, and
  // retrying them on a schedule only produces noise and rate-limit pressure.
  const { data: connections, error } = await admin
    .from('calendar_connections')
    .select('user_id, provider')
    .eq('status', 'connected');

  if (error) {
    console.error('[calendar:scheduled-sync] listing failed', error);
    return NextResponse.json({ error: 'Could not list connections.' }, { status: 500 });
  }

  const userIds = [...new Set((connections ?? []).map((row) => row.user_id))];
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, timezone')
    .in('id', userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000']);

  const timezoneByUser = new Map((profiles ?? []).map((row) => [row.id, row.timezone]));

  let synced = 0;
  let failed = 0;

  // Sequential on purpose: a burst of parallel requests to one provider is the
  // fastest way to get rate-limited, and this is a background job with no one
  // waiting on it.
  for (const connection of connections ?? []) {
    if (!isProviderId(connection.provider)) continue;

    const now = new Date();
    try {
      await syncBusyWindow(
        connection.user_id,
        connection.provider,
        { from: now, to: new Date(now.getTime() + SYNC_WINDOW_DAYS * 24 * 60 * 60 * 1000) },
        timezoneByUser.get(connection.user_id) ?? 'UTC',
      );
      synced += 1;
    } catch (syncError) {
      // `syncBusyWindow` has already recorded the reason on the connection, so
      // the user sees "needs reconnecting" next time they open Calendar.
      failed += 1;
      console.error('[calendar:scheduled-sync]', connection.provider, syncError);
    }
  }

  return NextResponse.json({ connections: connections?.length ?? 0, synced, failed });
}
