import type { Metadata } from 'next';

import { AuthForm } from '@/components/auth/auth-form';
import { isSafeRedirect } from '@/lib/safe-redirect';

export const metadata: Metadata = { title: 'Sign in' };

/**
 * `?next=` is read here, on the server, and validated before it is handed to
 * the form.
 *
 * Two things come out of that. The obvious one: only a same-origin relative
 * path can ever reach the client, so `?next=https://evil.example.com` is gone
 * before it is serialised into the RSC payload rather than being carried into
 * the page and filtered later.
 *
 * The quieter one: the form no longer calls `useSearchParams`, so it is not
 * forced behind a Suspense boundary that rendered a skeleton on the server and
 * only produced a real form once JavaScript arrived.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return <AuthForm mode="sign-in" next={isSafeRedirect(next) ? next : null} />;
}
