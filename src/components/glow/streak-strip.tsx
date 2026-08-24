import type { DateKey } from '@/lib/date';
import { dateRangeKeys } from '@/lib/date';
import { cn } from '@/lib/utils';

/**
 * The last N days, one block each, dark where the day was completed.
 *
 * A calendar heat strip rather than a number, because "26" says nothing about
 * whether the last week went well. It is `aria-hidden` with a sentence beside
 * it: 56 announced squares is not information, it is an obstacle.
 */
export function StreakStrip({
  percentByDate,
  from,
  to,
  columns,
  className,
}: {
  percentByDate: Map<DateKey, number>;
  from: DateKey;
  to: DateKey;
  columns?: number;
  className?: string;
}) {
  const days = dateRangeKeys(from, to);

  return (
    <div
      aria-hidden="true"
      className={cn('grid gap-1.5', className)}
      style={columns ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : undefined}
    >
      {days.map((day) => {
        const percent = percentByDate.get(day) ?? 0;
        return (
          <span
            key={day}
            className={cn(
              'aspect-square rounded-md',
              percent >= 100
                ? 'bg-primary-fill'
                : percent >= 60
                  ? 'bg-primary-fill/60'
                  : percent > 0
                    ? 'bg-primary-soft'
                    : 'bg-muted',
            )}
          />
        );
      })}
    </div>
  );
}

/** The legend that makes the strip readable without decoding the shades. */
export function StreakLegend({ className }: { className?: string }) {
  const steps = [
    { label: 'None', cls: 'bg-muted' },
    { label: 'Some', cls: 'bg-primary-soft' },
    { label: 'Most', cls: 'bg-primary-fill/60' },
    { label: 'All', cls: 'bg-primary-fill' },
  ];

  return (
    <ul className={cn('flex flex-wrap items-center gap-x-4 gap-y-2', className)}>
      {steps.map((step) => (
        <li key={step.label} className="flex items-center gap-2 text-[11.5px] text-muted-foreground">
          <span aria-hidden="true" className={cn('size-2.5 rounded-[3px]', step.cls)} />
          {step.label}
        </li>
      ))}
    </ul>
  );
}
