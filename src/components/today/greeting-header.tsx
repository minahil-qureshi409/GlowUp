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
  /** One line under the greeting — how the day is actually going. */
  subGreeting: string;
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
  subGreeting,
}: GreetingHeaderProps) {
  const now = useNow();

  const greeting = now ? greetingFor(currentDayHour(timezone, now)) : fallbackGreeting;
  const firstName = displayName?.trim().split(/\s+/)[0];

  return (
    <header className="px-1">
      <p className="eyebrow">
        {now ? (
          <time dateTime={now.toISOString()}>
            {formatInTimeZone(now, timezone, 'EEEE d MMMM')}
            <span className="tabular ml-2 normal-case tracking-normal">
              {formatInTimeZone(now, timezone, timeFormat === '24h' ? 'HH:mm' : 'h:mm a')}
            </span>
          </time>
        ) : (
          <span className="inline-block h-3 w-40 animate-pulse rounded bg-muted" />
        )}
      </p>

      <h1 className="mt-2 font-display text-display-md">
        {greeting}
        {firstName ? `, ${firstName}` : ''} <span aria-hidden="true">✨</span>
      </h1>

      <p className="mt-1.5 text-[14.5px] text-muted-foreground">{subGreeting}</p>
    </header>
  );
}
