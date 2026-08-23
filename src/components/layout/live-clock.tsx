'use client';

import { formatInTimeZone } from 'date-fns-tz';

import { useNow } from '@/hooks/use-now';
import type { Enums } from '@/lib/db/database.types';
import { cn } from '@/lib/utils';

type LiveClockProps = {
  timezone: string;
  timeFormat: Enums<'time_format'>;
  className?: string;
  showDate?: boolean;
};

/**
 * The real current time, in the user's configured timezone.
 *
 * Nothing about the app's behaviour depends on this being on screen — it is
 * context, not a deadline. It renders a stable placeholder until the client
 * clock is available so SSR and hydration agree.
 */
export function LiveClock({ timezone, timeFormat, className, showDate = true }: LiveClockProps) {
  const now = useNow();

  if (!now) {
    return (
      <div className={cn('h-5 w-40 animate-pulse rounded bg-muted/70', className)} aria-hidden="true" />
    );
  }

  const time = formatInTimeZone(now, timezone, timeFormat === '24h' ? 'HH:mm' : 'h:mm a');
  const date = formatInTimeZone(now, timezone, 'EEEE d MMMM');

  return (
    <p className={cn('text-sm text-muted-foreground', className)}>
      <time dateTime={now.toISOString()} className="tabular font-medium text-foreground">
        {time}
      </time>
      {showDate ? <span className="ml-2">{date}</span> : null}
    </p>
  );
}
