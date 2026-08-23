'use client';

import { formatInTimeZone } from 'date-fns-tz';

import { useNow } from '@/hooks/use-now';
import type { Enums } from '@/lib/db/database.types';
import { currentDayHour, greetingFor } from '@/lib/date';

type GreetingHeaderProps = {
  displayName: string | null;
  timezone: string;
  timeFormat: Enums<'time_format'>;
  /** Server-computed greeting, shown until the client clock resolves. */
  fallbackGreeting: string;
};

/**
 * The greeting follows the real clock.
 *
 * The server renders one based on its own read of the user's timezone; once the
 * client's clock is available it takes over, so the greeting stays right if the
 * page is left open across noon or the device crosses a timezone.
 */
export function GreetingHeader({
  displayName,
  timezone,
  timeFormat,
  fallbackGreeting,
}: GreetingHeaderProps) {
  const now = useNow();

  const greeting = now ? greetingFor(currentDayHour(timezone, now)) : fallbackGreeting;
  const firstName = displayName?.trim().split(/\s+/)[0];

  return (
    <header className="space-y-0.5 px-1">
      <h1 className="font-display text-2xl font-semibold tracking-tight">
        {greeting}
        {firstName ? `, ${firstName}` : ''} <span aria-hidden="true">✨</span>
      </h1>
      <p className="text-sm text-muted-foreground">
        {now ? (
          <time dateTime={now.toISOString()}>
            {formatInTimeZone(now, timezone, 'EEEE d MMMM')}
            <span className="tabular ml-2">
              {formatInTimeZone(now, timezone, timeFormat === '24h' ? 'HH:mm' : 'h:mm a')}
            </span>
          </time>
        ) : (
          <span className="inline-block h-4 w-40 animate-pulse rounded bg-muted/70" />
        )}
      </p>
    </header>
  );
}
