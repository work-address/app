import { useRef } from 'react'
import {
  Bar,
  BarChart,
  BarStack,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import styled from 'styled-components'

import { ChartLegend } from './chart-legend'
import { ChartPopup, pointInside } from './chart-popup'
import { ChartTooltip, type ChartTooltipContent } from './chart-tooltip'

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
  /** Optional presentation overrides; other charts keep their existing shape. */
  maxBarSize?: number
  barRadius?: number
  gridDasharray?: string
  /** Take the height of the card instead of `height`; the legend keeps its own. */
  fill?: boolean
  className?: string
  /**
   * Everything to say about a bar, laid out in columns. Without it the popup
   * lists the bar's series.
   */
  describe?: (bucketKey: string) => ChartTooltipContent | null
}

const SURFACE = 'var(--ui-surface)'

/** A breakdown popup's width, for its columns to sit side by side in. */
const POPUP_WIDTH = 600

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
  maxBarSize,
  barRadius,
  gridDasharray = '3 6',
  fill = false,
  className,
  describe,
}: Props) => {
  const plotRef = useRef<HTMLDivElement>(null)
  const data = buckets.map((bucket) => ({
    key: bucket.key,
    label: bucket.label,
    title: bucket.title,
    ...Object.fromEntries(
      series.map((s) => [s.key, bucket.values[s.key] ?? 0]),
    ),
  }))
  const bars = series.map((s, index) => (
    <Bar
      key={s.key}
      dataKey={s.key}
      name={s.label}
      stackId={stacked ? 'total' : undefined}
      fill={s.color}
      stroke={stacked ? SURFACE : undefined}
      strokeWidth={stacked ? 1 : 0}
      maxBarSize={maxBarSize ?? (stacked ? 36 : 18)}
      isAnimationActive={false}
      radius={
        !stacked || (barRadius === undefined && index === series.length - 1)
          ? [barRadius ?? 4, barRadius ?? 4, 0, 0]
          : [0, 0, 0, 0]
      }
    />
  ))

  return (
    <Root className={className} data-fill={fill || undefined}>
      <Plot ref={plotRef} style={fill ? undefined : { height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 8, right: 4, left: 0, bottom: 0 }}
            barCategoryGap={buckets.length > 20 ? '15%' : '28%'}
            barGap={2}
          >
            <CartesianGrid
              vertical={false}
              stroke="var(--ui-inset)"
              strokeDasharray={gridDasharray}
            />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tickMargin={8}
              // Drops labels that would collide at this width, keeping both ends.
              interval="preserveStartEnd"
              minTickGap={12}
              tick={{
                fontSize: 'var(--chart-label-size, 12px)',
                fill: 'var(--ui-muted)',
              }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              width={56}
              allowDecimals={false}
              tickFormatter={formatTick}
              tick={{
                fontSize: 'var(--chart-label-size, 12px)',
                fill: 'var(--ui-muted)',
              }}
            />
            <Tooltip
              cursor={{ fill: 'var(--ui-inset)' }}
              content={({ active, payload, coordinate }) => {
                if (!active || !payload?.length) {
                  return null
                }

                const row = payload[0].payload as Record<string, number> & {
                  key: string
                  title: string
                }
                const detail = describe?.(row.key)
                // Recharts measures from the plot, the popup from the screen.
                const anchor = () => pointInside(plotRef.current, coordinate)

                if (detail) {
                  return (
                    <ChartPopup anchor={anchor} width={POPUP_WIDTH}>
                      <ChartTooltip
                        title={detail.title ?? row.title}
                        rows={detail.rows}
                        sections={detail.sections}
                        note={detail.note}
                        layout="horizontal"
                      />
                    </ChartPopup>
                  )
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
                  <ChartPopup anchor={anchor}>
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
                  </ChartPopup>
                )
              }}
            />
            {stacked && barRadius !== undefined ? (
              <BarStack
                stackId="total"
                radius={[barRadius, barRadius, barRadius / 2, barRadius / 2]}
              >
                {bars}
              </BarStack>
            ) : (
              bars
            )}
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
  gap: var(--ui-space-3);

  /* The plot takes whatever the card leaves over the legend, so a chart
     beside a taller card has no dead band above or below its bars. */
  &[data-fill] {
    height: 100%;
    grid-template-rows: minmax(0, 1fr) auto;
  }
`

const Plot = styled.div`
  width: 100%;

  ${Root}[data-fill] & {
    height: 100%;
    min-height: 200px;
  }

  .recharts-surface {
    outline: none;
  }
`
