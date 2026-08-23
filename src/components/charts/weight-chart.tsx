'use client';

import * as React from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
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
import type { WeightPoint } from '@/lib/domain/weight';
import type { MilestoneProgress } from '@/lib/domain/weight';

type WeightChartProps = {
  points: WeightPoint[];
  milestones: MilestoneProgress[];
  goalKg: number | null;
  height?: number;
};

/**
 * Weight over time.
 *
 * Two series on one axis: the readings themselves, and the smoothed trend the
 * app actually reasons about. The trend is dashed so the pair reads apart
 * without relying on colour, which also covers the print and forced-colours
 * cases.
 *
 * Milestones are reference lines, not a countdown. There is deliberately no
 * projection into the future anywhere on this chart.
 */
export function WeightChart({ points, milestones, goalKg, height = 240 }: WeightChartProps) {
  const data = React.useMemo(
    () =>
      points.map((point) => ({
        date: point.date,
        weight: point.weightKg,
        trend: point.trendKg,
      })),
    [points],
  );

  const domain = React.useMemo(() => {
    const values = points.flatMap((p) => [p.weightKg, p.trendKg ?? p.weightKg]);
    const milestoneValues = milestones.map((m) => m.targetKg);
    const all = [...values, ...milestoneValues, ...(goalKg ? [goalKg] : [])];
    if (all.length === 0) return [40, 60] as const;

    const min = Math.min(...all);
    const max = Math.max(...all);
    const padding = Math.max(0.8, (max - min) * 0.12);
    return [Math.floor((min - padding) * 2) / 2, Math.ceil((max + padding) * 2) / 2] as const;
  }, [points, milestones, goalKg]);

  const lastPoint = data[data.length - 1];

  return (
    <ChartFrame
      title="Weight"
      description="Readings with a seven-day trend line."
      legend={[
        { label: 'Weigh-ins', color: SERIES[1] },
        { label: 'Trend', color: SERIES[3], dashed: true },
      ]}
      height={height}
      footnote="Milestones mark values, not dates. Progress follows your actual trend."
      after={
        <>
          {lastPoint ? (
            <p className="sr-only">
              Latest weigh-in {lastPoint.weight} kg on{' '}
              {formatDateKey(lastPoint.date, 'd MMMM yyyy')}.
            </p>
          ) : null}
          <ChartDataTable
            caption="Weight entries with trend"
            columns={['Date', 'Weigh-in (kg)', 'Trend (kg)']}
            rows={data.map((row) => [
              formatDateKey(row.date, 'd MMM yyyy'),
              row.weight.toFixed(1),
              row.trend?.toFixed(1) ?? '—',
            ])}
          />
        </>
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: -12 }}>
          <CartesianGrid stroke={GRID_COLOR} strokeDasharray="0" vertical={false} />

          <XAxis
            dataKey="date"
            {...axisProps}
            minTickGap={28}
            tickFormatter={(value: string) => formatDateKey(value, 'd MMM')}
          />
          <YAxis
            {...axisProps}
            domain={[domain[0], domain[1]]}
            width={44}
            tickFormatter={(value: number) => `${value}`}
          />

          {milestones.map((milestone) => (
            <ReferenceLine
              key={milestone.id}
              y={milestone.targetKg}
              stroke={AXIS_COLOR}
              strokeOpacity={milestone.reached ? 0.5 : 0.3}
              strokeDasharray="3 4"
              label={{
                value: `${milestone.targetKg}`,
                position: 'right',
                fill: AXIS_COLOR,
                fontSize: 10,
              }}
            />
          ))}

          <Tooltip
            cursor={{ stroke: AXIS_COLOR, strokeOpacity: 0.35, strokeWidth: 1 }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const weight = payload.find((entry) => entry.dataKey === 'weight')?.value;
              const trend = payload.find((entry) => entry.dataKey === 'trend')?.value;

              return (
                <ChartTooltip
                  title={formatDateKey(String(label), 'EEE d MMM yyyy')}
                  rows={[
                    ...(typeof weight === 'number'
                      ? [{ label: 'Weigh-in', value: `${weight.toFixed(1)} kg`, color: SERIES[1] }]
                      : []),
                    ...(typeof trend === 'number'
                      ? [{ label: 'Trend', value: `${trend.toFixed(1)} kg`, color: SERIES[3] }]
                      : []),
                  ]}
                />
              );
            }}
          />

          <Line
            type="monotone"
            dataKey="weight"
            name="Weigh-ins"
            stroke={SERIES[1]}
            strokeWidth={2}
            dot={{ r: 3, strokeWidth: 2, stroke: 'hsl(var(--chart-surface))', fill: SERIES[1] }}
            activeDot={{ r: 5, strokeWidth: 2, stroke: 'hsl(var(--chart-surface))' }}
            connectNulls
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="trend"
            name="Trend"
            stroke={SERIES[3]}
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={false}
            activeDot={false}
            connectNulls
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
