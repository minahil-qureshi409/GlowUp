'use client';

import * as React from 'react';

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Card, CardContent } from '@/components/ui/card';
import { Stat, StatGrid } from '@/components/common/stat';
import { formatDateKey, subDaysKey } from '@/lib/date';
import {
  SKIN_CONDITION_LABELS,
  conditionFrequency,
  periodConsistency,
  skincareTimeline,
  type SkincareEntry,
  type SkinLog,
} from '@/lib/domain/skincare';
import { cn } from '@/lib/utils';

export const TIMELINE_RANGES = [
  { key: '1m', label: '1 month', days: 30 },
  { key: '3m', label: '3 months', days: 90 },
  { key: '6m', label: '6 months', days: 182 },
  { key: '1y', label: '1 year', days: 365 },
] as const;

export type TimelineRangeKey = (typeof TIMELINE_RANGES)[number]['key'];

type SkincareTimelineProps = {
  today: string;
  entries: Pick<SkincareEntry, 'log_date' | 'period' | 'status'>[];
  logs: Pick<SkinLog, 'log_date' | 'conditions' | 'note'>[];
};

/**
 * Routine history as a dot grid.
 *
 * A calendar heatmap rather than a chart: the question here is "which days did
 * I do this", which is a lookup, not a trend. Each day shows two marks, morning
 * and evening, so the pattern is visible at a glance — and the shape carries
 * the meaning, not just the colour.
 */
export function SkincareTimeline({ today, entries, logs }: SkincareTimelineProps) {
  const [range, setRange] = React.useState<TimelineRangeKey>('1m');

  const days = TIMELINE_RANGES.find((r) => r.key === range)?.days ?? 30;
  const from = subDaysKey(today, days - 1);

  const points = React.useMemo(
    () => skincareTimeline(entries, logs, from, today),
    [entries, logs, from, today],
  );

  const am = periodConsistency(entries, 'am', from, today);
  const pm = periodConsistency(entries, 'pm', from, today);
  const conditions = conditionFrequency(logs, from, today).slice(0, 4);

  const recentNotes = points
    .filter((point) => point.note || point.conditions.length > 0)
    .slice(-6)
    .reverse();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-tight">Routine history</h2>
        <ToggleGroup
          type="single"
          value={range}
          onValueChange={(value) => value && setRange(value as TimelineRangeKey)}
          aria-label="Time range"
        >
          {TIMELINE_RANGES.map((option) => (
            <ToggleGroupItem key={option.key} value={option.key} className="px-2.5 text-xs">
              {option.key}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <Card>
        <CardContent className="space-y-4 p-4">
          <StatGrid columns={2}>
            <Stat
              label="Morning"
              value={`${am.rate}%`}
              hint={`${am.completedDays} of ${am.totalDays} days`}
            />
            <Stat
              label="Evening"
              value={`${pm.rate}%`}
              hint={`${pm.completedDays} of ${pm.totalDays} days`}
            />
          </StatGrid>

          <div>
            <div className="mb-2 flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-domain-nutrition" aria-hidden="true" />
                Morning
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-domain-skincare" aria-hidden="true" />
                Evening
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-muted" aria-hidden="true" />
                Not logged
              </span>
            </div>

            <div className="overflow-x-auto">
              <ol className="flex min-w-min gap-[3px]">
                {points.map((point) => (
                  <li key={point.date} className="flex flex-col gap-[3px]">
                    <span
                      className={cn(
                        'block size-2.5 rounded-[3px]',
                        point.am ? 'bg-domain-nutrition' : 'bg-muted',
                      )}
                      title={`${formatDateKey(point.date, 'd MMM')} — morning ${point.am ? 'done' : 'not logged'}`}
                    />
                    <span
                      className={cn(
                        'block size-2.5 rounded-[3px]',
                        point.pm ? 'bg-domain-skincare' : 'bg-muted',
                      )}
                      title={`${formatDateKey(point.date, 'd MMM')} — evening ${point.pm ? 'done' : 'not logged'}`}
                    />
                  </li>
                ))}
              </ol>
            </div>

            <p className="mt-2 flex justify-between text-[11px] text-muted-foreground">
              <span>{formatDateKey(from, 'd MMM')}</span>
              <span>{formatDateKey(today, 'd MMM')}</span>
            </p>
          </div>

          {conditions.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Most noted
              </p>
              <ul className="flex flex-wrap gap-2">
                {conditions.map((entry) => (
                  <li
                    key={entry.condition}
                    className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground"
                  >
                    {SKIN_CONDITION_LABELS[entry.condition]} · {entry.count}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {recentNotes.length > 0 ? (
        <Card>
          <CardContent className="p-4">
            <h3 className="mb-2 text-sm font-semibold">Recent notes</h3>
            <ul className="divide-y divide-border/70">
              {recentNotes.map((point) => (
                <li key={point.date} className="py-2.5 first:pt-0 last:pb-0">
                  <p className="text-xs font-medium text-muted-foreground">
                    {formatDateKey(point.date, 'EEE d MMM')}
                  </p>
                  {point.conditions.length > 0 ? (
                    <p className="mt-0.5 text-sm">
                      {point.conditions.map((c) => SKIN_CONDITION_LABELS[c]).join(', ')}
                    </p>
                  ) : null}
                  {point.note ? (
                    <p className="mt-0.5 text-sm text-muted-foreground">{point.note}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
