'use client';

import * as React from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

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
import { formatLoad, formatVolume } from '@/lib/format';
import type { ProgressionPoint } from '@/lib/domain/workout';

type StrengthChartProps = {
  exerciseName: string;
  points: ProgressionPoint[];
  metric: 'load' | 'volume';
  height?: number;
};

/**
 * Progression for one exercise.
 *
 * One measure at a time, chosen by the caller — load and volume live on
 * different scales, and putting them on two y-axes would make the crossings
 * mean nothing. A single series needs no legend box; the title names it.
 */
export function StrengthChart({
  exerciseName,
  points,
  metric,
  height = 200,
}: StrengthChartProps) {
  const data = React.useMemo(
    () =>
      points.map((point) => ({
        date: point.date,
        value: metric === 'load' ? point.topSetKg : point.volume,
        topSetKg: point.topSetKg,
        volume: point.volume,
        reps: point.totalReps,
      })),
    [points, metric],
  );

  const label = metric === 'load' ? 'Top set' : 'Session volume';

  return (
    <ChartFrame
      title={`${exerciseName} — ${label.toLowerCase()}`}
      description={
        metric === 'load'
          ? 'Heaviest working set in each session.'
          : 'Reps times weight across all working sets.'
      }
      height={height}
      after={
        <ChartDataTable
          caption={`${exerciseName} session history`}
          columns={['Date', 'Top set (kg)', 'Volume (kg)', 'Reps']}
          rows={data.map((row) => [
            formatDateKey(row.date, 'd MMM yyyy'),
            formatLoad(row.topSetKg),
            String(row.volume),
            String(row.reps),
          ])}
        />
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -12 }}>
          <CartesianGrid stroke={GRID_COLOR} vertical={false} />
          <XAxis
            dataKey="date"
            {...axisProps}
            minTickGap={28}
            tickFormatter={(value: string) => formatDateKey(value, 'd MMM')}
          />
          <YAxis {...axisProps} width={46} />
          <Tooltip
            cursor={{ stroke: AXIS_COLOR, strokeOpacity: 0.35, strokeWidth: 1 }}
            content={({ active, payload, label: tooltipLabel }) => {
              if (!active || !payload?.length) return null;
              const row = payload[0]?.payload as (typeof data)[number] | undefined;
              if (!row) return null;

              return (
                <ChartTooltip
                  title={formatDateKey(String(tooltipLabel), 'EEE d MMM yyyy')}
                  rows={[
                    {
                      label: 'Top set',
                      value: row.topSetKg ? `${formatLoad(row.topSetKg)} kg` : '—',
                      color: SERIES[4],
                    },
                    { label: 'Volume', value: formatVolume(row.volume) },
                    { label: 'Working reps', value: String(row.reps) },
                  ]}
                />
              );
            }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={SERIES[4]}
            strokeWidth={2}
            dot={{ r: 3, strokeWidth: 2, stroke: 'hsl(var(--chart-surface))', fill: SERIES[4] }}
            activeDot={{ r: 5, strokeWidth: 2, stroke: 'hsl(var(--chart-surface))' }}
            connectNulls
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
