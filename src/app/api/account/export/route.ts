import { NextResponse } from 'next/server';

import { getOptionalUser } from '@/server/auth';
import { buildAccountExport } from '@/services/account';
import { getUserToday } from '@/lib/date';

/**
 * Data export.
 *
 * A route rather than a server action because the result is a *file*: this
 * streams straight to the browser's downloads with a sensible filename, and
 * nothing has to be marshalled through a client component first.
 *
 * Reads through the signed-in user's own Supabase client, so RLS is the thing
 * deciding what is in the file.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getOptionalUser();
  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  try {
    const { data: profile } = await user.supabase
      .from('profiles')
      .select('timezone')
      .eq('id', user.userId)
      .maybeSingle();

    const payload = await buildAccountExport(user.supabase, user.userId, user.email);
    const filename = `glowup-export-${getUserToday(profile?.timezone ?? 'UTC')}.json`;

    return new NextResponse(JSON.stringify(payload, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        // Someone's whole health history: never cached by a proxy, never
        // stored on disk by the browser beyond the download itself.
        'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      },
    });
  } catch (error) {
    console.error('[account:export]', error);
    return NextResponse.json({ error: 'Could not build your export.' }, { status: 500 });
  }
}
