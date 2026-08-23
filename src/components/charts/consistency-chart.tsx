'use client';

import * as React from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import {
  AXIS_COLOR,
  ChartDataTable,
  ChartFrame,
  ChartTooltip,
  GRID_COLOR,
  SERIES,
  axisProps,
} from '@/components/charts/chart-primitives';
import { formatDateKey } from '@/lib/date';

export type ConsistencyPoint = {
  weekStart: string;
  /** 0–100. */
  value: number;
  label?: string;
};

type ConsistencyChartProps = {
  title: string;
  description?: string;
  points: ConsistencyPoint[];
  /** Which validated slot this measure owns. Stable per measure, never by rank. */
  seriesSlot?: 1 | 2 | 3 | 4 | 5;
  unit?: string;
  height?: number;
};

/**
 * Weekly consistency as bars.
 *
 * Bars because the comparison is between discrete weeks, not a continuous
 * quantity over time. The y-axis is pinned to 0–100 so a good week and a bad
 * week are the same height apart every time the chart is drawn — an
 * auto-scaled percentage axis quietly exaggerates small differences.
 */
export function ConsistencyChart({
  title,
  description,
  points,
  seriesSlot = 2,
  unit = '%',
  height = 180,
}: ConsistencyChartProps) {
  const color = SERIES[seriesSlot];

  const data = React.useMemo(
    () =>
      points.map((point) => ({
        weekStart: point.weekStart,
        value: Math.max(0, Math.min(100, point.value)),
        label: point.label ?? formatDateKey(point.weekStart, 'd MMM'),
      })),
    [points],
  );

  return (
    <ChartFrame
      title={title}
      description={description}
      height={height}
      after={
        <ChartDataTable
          caption={title}
          columns={['Week beginning', `Value (${unit})`]}
          rows={data.map((row) => [formatDateKey(row.weekStart, 'd MMM yyyy'), String(row.value)])}
        />
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: -20 }} barCategoryGap="28%">
          <CartesianGrid stroke={GRID_COLOR} vertical={false} />
          <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" />
          <YAxis {...axisProps} domain={[0, 100]} width={40} tickFormatter={(v: number) => `${v}`} />
          <Tooltip
            cursor={{ fill: AXIS_COLOR, fillOpacity: 0.08 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const row = payload[0]?.payload as (typeof data)[number] | undefined;
              if (!row) return null;
              return (
                <ChartTooltip
                  title={`Week of ${formatDateKey(row.weekStart, 'd MMM yyyy')}`}
                  rows={[{ label: title, value: `${row.value}${unit}`, color }]}
                />
              );
            }}
          />
          {/* 4px rounded ends on the data end only, anchored to the baseline. */}
          <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
