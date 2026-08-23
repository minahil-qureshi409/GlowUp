import { NextResponse, type NextRequest } from 'next/server';

import { getOptionalUser } from '@/server/auth';
import { getProvider, isProviderId } from '@/lib/calendar/registry';
import { completeHandshake } from '@/lib/calendar/oauth-session';
import { createAdminClient } from '@/lib/supabase/admin';
import { storeTokens, syncBusyWindow, SYNC_WINDOW_DAYS } from '@/services/calendar';

/**
 * Completes a calendar connection.
 *
 * Tokens are written with the service-role client into `calendar_credentials`,
 * a table no client role can read, and they are encrypted before they get
 * there. The browser never sees an access token, a leaked anon key cannot
 * reach one, and a database dump yields ciphertext.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const origin = request.nextUrl.origin;
  const { provider: providerParam } = await params;

  const user = await getOptionalUser();
  if (!user) return NextResponse.redirect(new URL('/login?next=/calendar', origin));

  if (!isProviderId(providerParam)) {
    return NextResponse.redirect(new URL('/calendar?error=unknown_provider', origin));
  }

  const search = request.nextUrl.searchParams;
  const providerError = search.get('error');
  const code = search.get('code');

  // Consumed first and unconditionally: a failed attempt must not leave a
  // reusable nonce behind, including the "user pressed Cancel" path.
  const handshake = await completeHandshake(providerParam, user.userId, search.get('state'));

  // The user pressing "Cancel" on the consent screen lands here too.
  if (providerError) {
    return NextResponse.redirect(
      new URL(`/calendar?error=${encodeURIComponent(providerError.slice(0, 40))}`, origin),
    );
  }

  if (!handshake.ok) {
    return NextResponse.redirect(new URL(`/calendar?error=${handshake.reason}`, origin));
  }

  if (!code) {
    return NextResponse.redirect(new URL('/calendar?error=missing_code', origin));
  }

  const provider = getProvider(providerParam);
  const admin = createAdminClient();

  try {
    const { tokens, account } = await provider.exchangeCode(code, handshake.verifier);

    const { data: connection, error: connectionError } = await admin
      .from('calendar_connections')
      .upsert(
        {
          user_id: user.userId,
          provider: providerParam,
          account_email: account.email,
          scopes: tokens.scopes,
          status: 'connected',
          last_error: null,
          connected_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,provider' },
      )
      .select('id')
      .single();

    if (connectionError) throw connectionError;

    await storeTokens(admin, connection.id, user.userId, tokens);

    // Warm the cache so the dashboard is calendar-aware straight away. A sync
    // failure here is not a connection failure, so it must not block the
    // redirect — the Calendar screen has a Refresh button for the retry.
    try {
      const { data: profile } = await admin
        .from('profiles')
        .select('timezone')
        .eq('id', user.userId)
        .maybeSingle();

      const now = new Date();
      await syncBusyWindow(
        user.userId,
        providerParam,
        { from: now, to: new Date(now.getTime() + SYNC_WINDOW_DAYS * 24 * 60 * 60 * 1000) },
        profile?.timezone ?? 'UTC',
      );
    } catch (syncError) {
      console.error('[calendar:initial-sync]', syncError);
    }

    return NextResponse.redirect(new URL('/calendar?connected=1', origin));
  } catch (exchangeError) {
    console.error('[calendar:oauth-callback]', exchangeError);
    return NextResponse.redirect(new URL('/calendar?error=exchange_failed', origin));
  }
}
