import type { Metadata } from 'next';

import { AmbientBackground } from '@/components/layout/ambient-background';

export const metadata: Metadata = { title: 'Offline' };

/**
 * What the service worker serves when a navigation cannot reach the network.
 *
 * Deliberately static and deliberately empty of data. The alternative — showing
 * a cached copy of Today — would mean presenting yesterday's weight and habit
 * ticks as if they were current, which is worse than showing nothing.
 *
 * No "Retry" button: a button that reloads is what the browser's own refresh
 * already does, and offering it implies the app can do something about the
 * connection. It cannot.
 */
export default function OfflinePage() {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 text-center">
      <AmbientBackground />

      <div className="relative z-10 max-w-sm">
        <p aria-hidden="true" className="text-[44px] leading-none">
          🌿
        </p>
        <h1 className="mt-4 font-display text-display-md">You&rsquo;re offline</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
          GlowUp needs a connection to load your day. Everything you have already logged is safe
          on the server — nothing is lost.
        </p>
        <p className="mt-6 text-[12.5px] text-subtle">
          This page will work again as soon as you have signal.
        </p>
      </div>
    </div>
  );
}
