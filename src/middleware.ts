import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

import { env } from '@/lib/env';

const PUBLIC_ROUTES = [
  '/login',
  '/signup',
  '/forgot-password',
  // Reachable signed out on purpose: an expired recovery link has to be able to
  // explain itself rather than bouncing to a login page that says nothing.
  '/reset-password',
  '/auth',
  '/legal',
  /*
   * Route handlers do their own auth and answer with a status code, not a
   * redirect. Bouncing them to /login would break the scheduled calendar sync
   * (a cron call carrying a bearer token and no session cookie) and would turn
   * an honest 401 from the export endpoint into an HTML login page.
   */
  '/api',
  // Sentry's ingest tunnel. Errors have to be reportable from a signed-out page.
  '/monitoring',
];

/** Signing in on these would be pointless or actively wrong. */
const SIGNED_IN_REDIRECTS = ['/login', '/signup', '/forgot-password'];

function isPublic(pathname: string) {
  return PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

/**
 * Refreshes the Supabase session cookie on every request and gates the app
 * routes. Auth state is read with `getUser()` (which verifies the JWT against
 * the auth server) rather than `getSession()`, which only decodes the cookie.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    // Preserve where they were heading so login can send them back.
    if (pathname !== '/') url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  // `/reset-password` is deliberately absent: someone following a recovery link
  // *is* signed in by the time they land there, and bouncing them to /today
  // would make the link do nothing.
  if (user && SIGNED_IN_REDIRECTS.includes(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/today';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and image optimisation, so the session
     * cookie is refreshed on real navigations only.
     */
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
