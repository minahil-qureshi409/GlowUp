import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { AmbientBackground } from '@/components/layout/ambient-background';
import { getOptionalUser } from '@/server/auth';

export const metadata: Metadata = {
  title: 'GlowUp — become your best self, one day at a time',
};

/**
 * The welcome screen.
 *
 * Signed in, the root is still a router: straight to Today, because someone who
 * already uses the app does not need to be sold it again. Signed out, this is
 * the first thing anyone sees, and it says what the app is for in one sentence.
 */
export default async function RootPage() {
  const user = await getOptionalUser();
  if (user) redirect('/today');

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <AmbientBackground />

      <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col px-5 pb-8 pt-4">
        <div
          aria-hidden="true"
          className="hatch mt-2 h-[46vh] max-h-[392px] min-h-[240px] rounded-[2rem] border border-border-soft"
        />

        <div className="pt-8">
          <p className="eyebrow text-primary">Welcome to GlowUp</p>
          <h1 className="mt-4 text-pretty font-display text-display-xl">
            Become your best self, one day at a time.
          </h1>
          <p className="mt-4 text-pretty text-[15px] leading-relaxed text-muted-foreground">
            Small daily actions across nutrition, movement, skin and sleep. No pressure, just
            gentle momentum.
          </p>
        </div>

        <div className="mt-auto flex flex-col gap-2.5 pt-10">
          <Link
            href="/signup"
            className="rounded-2xl bg-primary px-5 py-4 text-center text-[15.5px] font-semibold text-primary-foreground transition-[filter,transform] hover:brightness-[1.06] active:scale-[0.985] motion-reduce:active:scale-100"
          >
            Get started
          </Link>
          <Link
            href="/login"
            className="rounded-2xl px-5 py-3 text-center text-[14.5px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            I already have an account
          </Link>
        </div>

        <p className="pt-6 text-center text-[11px] leading-relaxed text-subtle">
          GlowUp is a personal tracker, not medical advice.{' '}
          <Link href="/legal/privacy" className="underline underline-offset-2">
            Privacy
          </Link>{' '}
          ·{' '}
          <Link href="/legal/terms" className="underline underline-offset-2">
            Terms
          </Link>
        </p>
      </div>
    </div>
  );
}
