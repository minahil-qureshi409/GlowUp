import Link from 'next/link';

import { cn } from '@/lib/utils';

export const RANGES = ['7D', '30D', '3M', '6M', '1Y'] as const;
export type Range = (typeof RANGES)[number];

export const RANGE_DAYS: Record<Range, number> = {
  '7D': 6,
  '30D': 29,
  '3M': 89,
  '6M': 181,
  '1Y': 364,
};

export function rangeFromParam(value: string | undefined, fallback: Range = '30D'): Range {
  return (RANGES as readonly string[]).includes(value ?? '') ? (value as Range) : fallback;
}

/**
 * The segmented range picker.
 *
 * Links rather than buttons, so the range is in the URL: shareable, restorable,
 * and back-navigable. A client-side toggle would lose all three, and the data
 * has to come from the server for the long ranges anyway.
 */
export function RangeTabs({
  basePath,
  active,
  ranges = RANGES,
  className,
}: {
  basePath: string;
  active: Range;
  ranges?: readonly Range[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex gap-1 rounded-full border border-border-soft bg-muted p-1',
        className,
      )}
    >
      {ranges.map((range) => {
        const isActive = range === active;
        return (
          <Link
            key={range}
            href={`${basePath}?range=${range}`}
            scroll={false}
            aria-current={isActive ? 'true' : undefined}
            className={cn(
              'rounded-full px-3 py-1.5 text-[11.5px] font-semibold transition-colors',
              isActive ? 'bg-card text-foreground shadow-pill' : 'text-subtle hover:text-foreground',
            )}
          >
            {range}
          </Link>
        );
      })}
    </div>
  );
}
