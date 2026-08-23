'use client';

import * as React from 'react';
import { Dumbbell, Scale, Sparkles } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { Enums } from '@/lib/db/database.types';
import type { BusyBlock } from '@/lib/domain/planner';
import { mergeBusy, totalBusyHours } from '@/lib/domain/planner';
import {
  DAY_NAMES_SHORT,
  dayOfWeek,
  formatClockTime,
  formatDateKey,
  hourToTime,
  weekDayKeys,
} from '@/lib/date';
import { cn } from '@/lib/utils';

export type WeekDayData = {
  date: string;
  busy: BusyBlock[];
  workoutCompleted: boolean;
  workoutName: string | null;
  skincareAm: boolean;
  skincarePm: boolean;
  weighIn: number | null;
  habitPercent: number;
};

type WeekViewProps = {
  weekStart: string;
  today: string;
  days: WeekDayData[];
  workWindow: { startHour: number; endHour: number } | null;
  gymWindow: { startHour: number; endHour: number } | null;
  gymDays: number[];
  timeFormat: Enums<'time_format'>;
};

/**
 * The week at a glance.
 *
 * Deliberately not an hourly grid. It answers "what happened, and roughly how
 * full was each day" — the questions this app is actually about — without
 * turning into a scheduling tool that implies things should have happened at
 * particular times.
 */
export function WeekView({
  weekStart,
  today,
  days,
  workWindow,
  gymWindow,
  gymDays,
  timeFormat,
}: WeekViewProps) {
  const [selected, setSelected] = React.useState<string>(today);
  const selectedDay = days.find((day) => day.date === selected) ?? null;

  /**
   * One array, seven entries, every label derived from the date it belongs to.
   *
   * The weekday name used to be looked up by array index (`(index + 1) % 7`),
   * which meant the visible letters, the `aria-label` and the selected-day
   * state were three independent computations that could — and did — disagree.
   */
  const dayKeys = weekDayKeys(weekStart).map((date) => ({
    date,
    shortName: DAY_NAMES_SHORT[dayOfWeek(date)] ?? '',
    dayOfMonth: Number(date.slice(8)),
    fullLabel: formatDateKey(date, 'EEEE d MMMM'),
  }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-7 gap-1.5">
        {dayKeys.map(({ date, shortName, dayOfMonth, fullLabel }) => {
          const day = days.find((d) => d.date === date);
          const isToday = date === today;
          const isSelected = date === selected;
          const isFuture = date > today;
          const busyHours = day ? totalBusyHours(day.busy) : 0;

          return (
            <button
              key={date}
              type="button"
              onClick={() => setSelected(date)}
              aria-pressed={isSelected}
              aria-current={isToday ? 'date' : undefined}
              aria-label={`${fullLabel}${isToday ? ', today' : ''}`}
              className={cn(
                'flex min-h-[4.5rem] flex-col items-center gap-1 rounded-xl border px-1 py-2 transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isSelected ? 'border-primary bg-primary-soft' : 'border-border hover:bg-muted/50',
                isFuture && 'opacity-60',
              )}
            >
              <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {shortName}
              </span>
              <span
                className={cn(
                  'tabular text-sm font-semibold',
                  isToday && 'text-primary',
                )}
              >
                {dayOfMonth}
              </span>

              <span className="flex gap-0.5" aria-hidden="true">
                {day?.workoutCompleted ? (
                  <span className="size-1.5 rounded-full bg-domain-workout" />
                ) : null}
                {day?.skincareAm || day?.skincarePm ? (
                  <span className="size-1.5 rounded-full bg-domain-skincare" />
                ) : null}
                {day?.weighIn !== null && day?.weighIn !== undefined ? (
                  <span className="size-1.5 rounded-full bg-domain-weight" />
                ) : null}
              </span>

              {busyHours > 0 ? (
                <span className="text-[9px] text-muted-foreground">
                  {Math.round(busyHours)}h
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <ul className="flex flex-wrap gap-x-4 gap-y-1 px-1 text-[11px] text-muted-foreground">
        <li className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-domain-workout" aria-hidden="true" />
          Workout
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-domain-skincare" aria-hidden="true" />
          Skincare
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-domain-weight" aria-hidden="true" />
          Weigh-in
        </li>
      </ul>

      {selectedDay ? (
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-sm font-semibold">
                {formatDateKey(selectedDay.date, 'EEEE d MMMM')}
              </h3>
              <span className="tabular text-xs text-muted-foreground">
                {selectedDay.habitPercent}% of habits
              </span>
            </div>

            <dl className="space-y-2 text-sm">
              {workWindow && !isWeekend(selectedDay.date) ? (
                <Row label="Work">
                  {formatClockTime(hourToTime(workWindow.startHour), timeFormat)} –{' '}
                  {formatClockTime(hourToTime(workWindow.endHour), timeFormat)}
                </Row>
              ) : null}

              {gymWindow && gymDays.includes(dayIndex(selectedDay.date)) ? (
                <Row label="Office gym">
                  until {formatClockTime(hourToTime(gymWindow.endHour), timeFormat)}
                </Row>
              ) : null}

              {selectedDay.busy.length > 0 ? (
                <Row label="Busy">
                  {mergeBusy(selectedDay.busy)
                    .slice(0, 3)
                    .map(
                      (block) =>
                        `${formatClockTime(hourToTime(block.startHour), timeFormat)}–${formatClockTime(hourToTime(block.endHour), timeFormat)}`,
                    )
                    .join(', ')}
                  {selectedDay.busy.length > 3 ? ` +${selectedDay.busy.length - 3}` : ''}
                </Row>
              ) : null}
            </dl>

            <ul className="space-y-1.5 border-t border-border/60 pt-3 text-sm">
              <Item
                icon={Dumbbell}
                done={selectedDay.workoutCompleted}
                label={selectedDay.workoutName ?? 'Strength workout'}
              />
              <Item icon={Sparkles} done={selectedDay.skincareAm} label="Morning skincare" />
              <Item icon={Sparkles} done={selectedDay.skincarePm} label="Evening skincare" />
              <Item
                icon={Scale}
                done={selectedDay.weighIn !== null}
                label={
                  selectedDay.weighIn !== null
                    ? `Weigh-in — ${selectedDay.weighIn.toFixed(1)} kg`
                    : 'Weigh-in'
                }
              />
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {selected !== today ? (
        <Button variant="ghost" size="sm" className="w-full" onClick={() => setSelected(today)}>
          Back to today
        </Button>
      ) : null}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-3">
      <dt className="w-24 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="tabular min-w-0 flex-1 text-right">{children}</dd>
    </div>
  );
}

function Item({
  icon: Icon,
  done,
  label,
}: {
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  done: boolean;
  label: string;
}) {
  return (
    <li className="flex items-center gap-2.5">
      <Icon
        className={cn('size-4 shrink-0', done ? 'text-primary' : 'text-muted-foreground/60')}
        aria-hidden
      />
      <span className={cn('flex-1 truncate', !done && 'text-muted-foreground')}>{label}</span>
      <span className="text-xs text-muted-foreground">{done ? 'Done' : '—'}</span>
    </li>
  );
}

function dayIndex(date: string): number {
  return dayOfWeek(date);
}

function isWeekend(date: string): boolean {
  const day = dayIndex(date);
  return day === 0 || day === 6;
}
