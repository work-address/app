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
  /**
   * `columns` stands the bars up along the bottom; `rows` lays them across,
   * one labelled row per bucket, for a narrow screen with few buckets.
   */
  orientation?: 'columns' | 'rows'
  className?: string
  /**
   * Everything to say about a bar, laid out in columns. Without it the popup
   * lists the bar's series.
   */
  describe?: (bucketKey: string) => ChartTooltipContent | null
}

const SURFACE = 'var(--ui-surface)'

/** Each bucket's height when the bars lie in rows. */
const ROW_HEIGHT = 40

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
  orientation = 'columns',
  className,
  describe,
}: Props) => {
  const plotRef = useRef<HTMLDivElement>(null)
  const rows = orientation === 'rows'
  // A rounded data end: the top of a column, the right of a row.
  const end = (r: number): [number, number, number, number] =>
    rows ? [0, r, r, 0] : [r, r, 0, 0]
  const tick = {
    fontSize: 'var(--chart-label-size, 12px)',
    fill: 'var(--ui-muted)',
  }
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
          ? end(barRadius ?? 4)
          : [0, 0, 0, 0]
      }
    />
  ))

  return (
    <Root className={className} data-fill={fill || undefined}>
      <Plot
        ref={plotRef}
        style={
          fill && !rows
            ? undefined
            : { height: rows ? buckets.length * ROW_HEIGHT + 32 : height }
        }
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout={rows ? 'vertical' : 'horizontal'}
            margin={{ top: 8, right: rows ? 12 : 4, left: 0, bottom: 0 }}
            barCategoryGap={buckets.length > 20 ? '15%' : '28%'}
            barGap={2}
          >
            <CartesianGrid
              vertical={rows}
              horizontal={!rows}
              stroke="var(--ui-inset)"
              strokeDasharray={gridDasharray}
            />
            {rows ? (
              <>
                <XAxis
                  type="number"
                  axisLine={false}
                  tickLine={false}
                  tickMargin={8}
                  allowDecimals={false}
                  tickFormatter={formatTick}
                  tick={tick}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  width={56}
                  interval={0}
                  tick={tick}
                />
              </>
            ) : (
              <>
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tickMargin={8}
                  // Drops labels that would collide at this width, keeping both ends.
                  interval="preserveStartEnd"
                  minTickGap={12}
                  tick={tick}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  width={56}
                  allowDecimals={false}
                  tickFormatter={formatTick}
                  tick={tick}
                />
              </>
            )}
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
                radius={
                  rows
                    ? [barRadius / 2, barRadius, barRadius, barRadius / 2]
                    : [barRadius, barRadius, barRadius / 2, barRadius / 2]
                }
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
