import { NextResponse } from 'next/server';

import { getOptionalUser } from '@/server/auth';
// The dav package does not ship TypeScript declarations.
// @ts-expect-error No declaration file is available for this module.
import * as dav from 'dav';

export async function GET() {
  const user = await getOptionalUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  try {
    const xhr = new dav.transport.Basic(
      new dav.Credentials({
        username: process.env.APPLE_ID!,
        password: process.env.APPLE_APP_PASSWORD!,
      })
    );

    const account = await dav.createAccount({
      server: process.env.APPLE_CALDAV_URL!,
      xhr,
      loadCollections: true,
      loadObjects: true,
    });

    // Sirf start/end return karo (privacy promise)
    const busyBlocks = account.calendars.flatMap((cal: any) =>
      cal.objects.map((obj: any) => ({
        start: obj.data.start,
        end: obj.data.end,
      }))
    );

    return NextResponse.json({ busyBlocks });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
