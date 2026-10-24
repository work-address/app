import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import styled from 'styled-components'

import { ChartLegend } from './chart-legend'
import { ChartTooltip } from './chart-tooltip'

export type BucketSeries = { key: string; label: string; color: string }

export type Bucket = {
  key: string
  /** Short axis label. */
  label: string
  /** Full label for the tooltip. */
  title: string
  values: Record<string, number>
}

type Props = {
  buckets: Bucket[]
  series: BucketSeries[]
  /** Stacked segments add up to one bar; grouped bars stand side by side. */
  stacked?: boolean
  formatValue: (value: number) => string
  formatTick: (value: number) => string
  totalLabel?: string
  emptyLabel: string
  height?: number
}

const SURFACE = 'var(--white)'

/**
 * Bars per day, week or month - one value per series in each. One axis, thin
 * bars with rounded data ends, a hair of surface between stacked segments,
 * and a legend whenever there is more than one series.
 */
export const BucketBarChart = ({
  buckets,
  series,
  stacked = true,
  formatValue,
  formatTick,
  totalLabel,
  emptyLabel,
  height = 240,
}: Props) => {
  const data = buckets.map((bucket) => ({
    label: bucket.label,
    title: bucket.title,
    ...Object.fromEntries(
      series.map((s) => [s.key, bucket.values[s.key] ?? 0]),
    ),
  }))

  return (
    <Root>
      <Plot style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 8, right: 4, left: 0, bottom: 0 }}
            barCategoryGap={buckets.length > 20 ? '15%' : '28%'}
            barGap={2}
          >
            <CartesianGrid
              vertical={false}
              stroke="var(--ds-neutral-alpha-4)"
              strokeDasharray="3 6"
            />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tickMargin={8}
              // Drops labels that would collide at this width, keeping both ends.
              interval="preserveStartEnd"
              minTickGap={12}
              tick={{ fontSize: 12, fill: 'var(--ds-neutral-11)' }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              width={44}
              allowDecimals={false}
              tickFormatter={formatTick}
              tick={{ fontSize: 12, fill: 'var(--ds-neutral-11)' }}
            />
            <Tooltip
              cursor={{ fill: 'var(--ds-neutral-alpha-3)' }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) {
                  return null
                }

                const row = payload[0].payload as Record<string, number> & {
                  title: string
                }
                const rows = series
                  .filter((s) => (row[s.key] ?? 0) > 0)
                  .map((s) => ({
                    label: s.label,
                    color: s.color,
                    value: formatValue(row[s.key]),
                  }))
                const total = series.reduce(
                  (sum, s) => sum + (row[s.key] ?? 0),
                  0,
                )

                return (
                  <ChartTooltip
                    title={row.title}
                    rows={rows}
                    empty={emptyLabel}
                    total={
                      totalLabel && rows.length > 1
                        ? { label: totalLabel, value: formatValue(total) }
                        : undefined
                    }
                  />
                )
              }}
            />
            {series.map((s, index) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label}
                stackId={stacked ? 'total' : undefined}
                fill={s.color}
                stroke={stacked ? SURFACE : undefined}
                strokeWidth={stacked ? 1 : 0}
                maxBarSize={stacked ? 36 : 18}
                isAnimationActive={false}
                radius={
                  !stacked || index === series.length - 1
                    ? [4, 4, 0, 0]
                    : [0, 0, 0, 0]
                }
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </Plot>
      <ChartLegend
        items={series.map((s) => ({ label: s.label, color: s.color }))}
      />
    </Root>
  )
}

const Root = styled.div`
  display: grid;
  gap: var(--space-3);
`

const Plot = styled.div`
  width: 100%;

  .recharts-surface {
    outline: none;
  }
`
