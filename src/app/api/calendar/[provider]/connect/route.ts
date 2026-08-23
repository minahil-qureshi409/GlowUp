import { NextResponse, type NextRequest } from 'next/server';

import { getOptionalUser } from '@/server/auth';
import { getProvider, isProviderId } from '@/lib/calendar/registry';
import { createPkcePair } from '@/lib/calendar/crypto';
import { beginHandshake } from '@/lib/calendar/oauth-session';

/**
 * Starts a calendar connection, for any registered provider.
 *
 * One route for all of them: the provider id is a path segment, validated
 * against the registry so an unknown value can never reach an implementation.
 * Adding Apple later needs no change here.
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

  const provider = getProvider(providerParam);
  if (!provider.isConfigured()) {
    return NextResponse.redirect(new URL('/calendar?error=not_configured', origin));
  }

  try {
    // The verifier stays server-side in an httpOnly cookie; only the challenge
    // travels to the provider, so an intercepted code is useless on its own.
    const { verifier, challenge } = createPkcePair();
    const state = await beginHandshake(providerParam, user.userId, verifier);

    return NextResponse.redirect(provider.authorizeUrl(state, challenge));
  } catch (error) {
    // Reaching here means the deployment is misconfigured (usually a missing
    // CALENDAR_TOKEN_KEY). The Calendar page says so rather than 500ing.
    console.error('[calendar:connect]', error);
    return NextResponse.redirect(new URL('/calendar?error=not_configured', origin));
  }
}
