'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Shared chart furniture.
 *
 * Series colours come from `--chart-1..5`, a palette validated per mode for
 * lightness band, chroma floor, protan/deutan separation and contrast against
 * the card surface. Slots are assigned in fixed order and never cycled: a chart
 * that would need a sixth series gets folded or facetted instead.
 */
export const SERIES = {
  1: 'var(--chart-1)',
  2: 'var(--chart-2)',
  3: 'var(--chart-3)',
  4: 'var(--chart-4)',
  5: 'var(--chart-5)',
} as const;

export const GRID_COLOR = 'hsl(var(--chart-grid))';
export const AXIS_COLOR = 'hsl(var(--chart-axis))';
export const SURFACE_COLOR = 'hsl(var(--chart-surface))';

/** Axis text wears ink tokens, never a series colour. */
export const axisTick = {
  fill: AXIS_COLOR,
  fontSize: 11,
} as const;

export const axisProps = {
  tickLine: false,
  axisLine: false,
  tick: axisTick,
  tickMargin: 8,
} as const;

type ChartFrameProps = {
  title: string;
  description?: string;
  /** Legend entries. Required for two or more series. */
  legend?: { label: string; color: string; dashed?: boolean }[];
  action?: React.ReactNode;
  footnote?: React.ReactNode;
  /** The plot itself. Rendered inside the fixed-height, horizontally scrollable box. */
  children: React.ReactNode;
  /** Anything that belongs after the plot — a data table, a caption, a note. */
  after?: React.ReactNode;
  className?: string;
  /** Height of the plot area. Charts stay short on phones. */
  height?: number;
};

export function ChartFrame({
  title,
  description,
  legend,
  action,
  footnote,
  children,
  after,
  className,
  height = 220,
}: ChartFrameProps) {
  return (
    <figure className={cn('space-y-3', className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <figcaption className="text-sm font-semibold tracking-tight">{title}</figcaption>
          {description ? (
            <p className="text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action}
      </div>

      {legend && legend.length > 1 ? (
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {legend.map((item) => (
            <li key={item.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span
                aria-hidden="true"
                className="inline-block h-0.5 w-4 rounded-full"
                style={
                  item.dashed
                    ? {
                        backgroundImage: `repeating-linear-gradient(90deg, ${item.color} 0 4px, transparent 4px 7px)`,
                      }
                    : { backgroundColor: item.color }
                }
              />
              {item.label}
            </li>
          ))}
        </ul>
      ) : null}

      {/* Wide plots scroll inside their own box; the page never scrolls sideways. */}
      <div className="w-full overflow-x-auto" style={{ height }}>
        {children}
      </div>

      {footnote ? <p className="text-xs text-muted-foreground">{footnote}</p> : null}
      {after}
    </figure>
  );
}

type TooltipRow = { label: string; value: string; color?: string };

/** Consistent tooltip shell — values in ink, a colour chip carrying identity. */
export function ChartTooltip({ title, rows }: { title: string; rows: TooltipRow[] }) {
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lifted">
      <p className="mb-1 font-medium text-popover-foreground">{title}</p>
      <ul className="space-y-0.5">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center gap-2">
            {row.color ? (
              <span
                aria-hidden="true"
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: row.color }}
              />
            ) : null}
            <span className="text-muted-foreground">{row.label}</span>
            <span className="tabular ml-auto font-medium text-popover-foreground">{row.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The table behind a chart.
 *
 * Not a nicety: it is the fallback that keeps a chart readable when colour
 * alone cannot carry it, and it is what a screen reader gets instead of an SVG.
 */
export function ChartDataTable({
  caption,
  columns,
  rows,
}: {
  caption: string;
  columns: string[];
  rows: (string | number)[][];
}) {
  return (
    <details className="group mt-2">
      <summary className="cursor-pointer list-none text-xs text-muted-foreground underline-offset-4 hover:underline">
        <span className="group-open:hidden">Show data table</span>
        <span className="hidden group-open:inline">Hide data table</span>
      </summary>
      <div className="mt-2 max-h-64 overflow-auto rounded-lg border border-border">
        <table className="w-full text-xs">
          <caption className="sr-only">{caption}</caption>
          <thead className="sticky top-0 bg-muted/80 backdrop-blur">
            <tr>
              {columns.map((column) => (
                <th key={column} scope="col" className="px-3 py-2 text-left font-medium">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index} className="border-t border-border/70">
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="tabular px-3 py-1.5">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
