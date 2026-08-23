'use client';

import * as React from 'react';

/**
 * The current instant, refreshed on a schedule.
 *
 * `null` on the first render and during SSR: the server's clock is not the
 * user's clock, so rendering a time before hydration would guarantee a mismatch
 * *and* briefly show the wrong hour. Callers render a placeholder until it
 * resolves.
 *
 * The tick is aligned to the next whole minute rather than firing every 60s
 * from mount, so the displayed time changes when the minute actually changes.
 */
export function useNow(intervalMs = 60_000): Date | null {
  const [now, setNow] = React.useState<Date | null>(null);

  React.useEffect(() => {
    setNow(new Date());

    let intervalId: ReturnType<typeof setInterval> | undefined;

    const msToNextTick = intervalMs - (Date.now() % intervalMs);
    const timeoutId = setTimeout(() => {
      setNow(new Date());
      intervalId = setInterval(() => setNow(new Date()), intervalMs);
    }, msToNextTick);

    // Coming back from a background tab can skip many ticks; resync on return.
    const onVisibility = () => {
      if (document.visibilityState === 'visible') setNow(new Date());
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [intervalMs]);

  return now;
}
