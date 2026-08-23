import { NextResponse, type NextRequest } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { safeRedirect } from '@/lib/safe-redirect';

/**
 * Email-confirmation and password-reset landing point.
 *
 * Exchanges the one-time code for a session cookie, then sends the user on.
 * `next` is validated as a relative path so the callback can't be used as an
 * open redirect.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  // Same rule as the login redirect: a same-origin relative path or nothing.
  const next = safeRedirect(searchParams.get('next'));

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=invalid_code`);
  }

  // A brand-new account still needs onboarding; a returning one does not.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('onboarding_completed_at')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile?.onboarding_completed_at && next === '/today') {
      return NextResponse.redirect(`${origin}/onboarding`);
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
