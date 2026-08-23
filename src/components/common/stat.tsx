import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

type StatProps = {
  label: string;
  value: React.ReactNode;
  /** Small qualifier under the value — a unit, a date, a ratio. */
  hint?: React.ReactNode;
  icon?: LucideIcon;
  /**
   * A delta is a fact, not a grade: it is rendered in ink, with an arrow
   * carrying direction, never in red-vs-green "good/bad" colour.
   */
  delta?: { value: string; direction: 'up' | 'down' | 'flat' } | undefined;
  className?: string;
};

/**
 * A single number with its label. Deliberately not a chart — most of what this
 * app reports is one value, and a value does not need axes.
 */
export function Stat({ label, value, hint, icon: Icon, delta, className }: StatProps) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {Icon ? <Icon className="size-3.5" aria-hidden="true" /> : null}
        <span>{label}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="tabular text-2xl font-semibold leading-none tracking-tight">{value}</span>
        {delta ? (
          <span className="tabular text-xs font-medium text-muted-foreground">
            <span aria-hidden="true">
              {delta.direction === 'up' ? '↑' : delta.direction === 'down' ? '↓' : '→'}
            </span>{' '}
            {delta.value}
          </span>
        ) : null}
      </div>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

type StatGridProps = {
  children: React.ReactNode;
  className?: string;
  columns?: 2 | 3 | 4;
};

export function StatGrid({ children, className, columns = 2 }: StatGridProps) {
  return (
    <div
      className={cn(
        'grid gap-x-4 gap-y-5',
        columns === 2 && 'grid-cols-2',
        columns === 3 && 'grid-cols-2 sm:grid-cols-3',
        columns === 4 && 'grid-cols-2 lg:grid-cols-4',
        className,
      )}
    >
      {children}
    </div>
  );
}
