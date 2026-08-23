import Link from 'next/link';
import { Briefcase, CalendarDays, Clock, MapPin } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { Enums } from '@/lib/db/database.types';
import { DAY_SHAPE_LABELS, type DailyPlan } from '@/lib/domain/planner';
import { formatClockTime, hourToTime } from '@/lib/date';

type DayContextCardProps = {
  plan: DailyPlan;
  timeFormat: Enums<'time_format'>;
  calendarConnected: boolean;
};

/**
 * Context for the day — work hours, gym access, how full the calendar looks.
 *
 * Read-only by design. It reports what the day looks like so the user can
 * decide; it never tells them what to do with it. Everything actionable lives
 * in the dismissible suggestion cards above.
 */
export function DayContextCard({ plan, timeFormat, calendarConnected }: DayContextCardProps) {
  const hasWork = plan.workWindow !== null;
  const gym = plan.gym;

  // Nothing worth a card: no work hours, no gym, no calendar.
  if (!hasWork && !gym && !calendarConnected) return null;

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold tracking-tight">{DAY_SHAPE_LABELS[plan.dayShape]}</h2>
          {calendarConnected ? (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
              Calendar connected
            </span>
          ) : null}
        </div>

        <dl className="space-y-2 text-sm">
          {plan.workWindow ? (
            <div className="flex items-center gap-2.5">
              <Briefcase className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <dt className="text-muted-foreground">Work</dt>
              <dd className="tabular ml-auto font-medium">
                {formatClockTime(hourToTime(plan.workWindow.startHour), timeFormat)} –{' '}
                {formatClockTime(hourToTime(plan.workWindow.endHour), timeFormat)}
              </dd>
            </div>
          ) : null}

          {gym ? (
            <div className="flex items-center gap-2.5">
              <MapPin className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <dt className="truncate text-muted-foreground">{gym.name}</dt>
              <dd className="ml-auto shrink-0 text-right font-medium">
                {!gym.availableToday ? (
                  <span className="text-muted-foreground">Not available today</span>
                ) : gym.window ? (
                  <span className="tabular">
                    {gym.openNow ? 'Open until ' : 'Access '}
                    {formatClockTime(hourToTime(gym.window.endHour), timeFormat)}
                  </span>
                ) : (
                  'Available'
                )}
              </dd>
            </div>
          ) : null}

          {gym?.availableToday && gym.closesInMinutes !== null && gym.closesInMinutes <= 120 ? (
            <div className="flex items-center gap-2.5">
              <Clock className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <dt className="text-muted-foreground">Time left there</dt>
              <dd className="tabular ml-auto font-medium">
                {gym.closesInMinutes < 60
                  ? `${gym.closesInMinutes} min`
                  : `${Math.floor(gym.closesInMinutes / 60)}h ${gym.closesInMinutes % 60}m`}
              </dd>
            </div>
          ) : null}
        </dl>

        {!calendarConnected ? (
          <div className="flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2.5">
            <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <p className="flex-1 text-xs text-muted-foreground">
              Connect a calendar and suggestions will work around your actual day.
            </p>
            <Button size="sm" variant="ghost" asChild>
              <Link href="/calendar">Connect</Link>
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
