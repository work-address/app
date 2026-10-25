import { useLayoutEffect, useRef, useState } from 'react'
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
  /**
   * Everything to say about a bar, laid out in columns. Without it the popup
   * lists the bar's series.
   */
  describe?: (bucketKey: string) => ChartTooltipContent | null
}

const SURFACE = 'var(--white)'

/** A breakdown popup's width where the plot has room for it. */
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
  describe,
}: Props) => {
  const plotRef = useRef<HTMLDivElement>(null)
  const [plotWidth, setPlotWidth] = useState(0)

  // The popup's width follows the plot's, which only the DOM knows.
  useLayoutEffect(() => {
    const plot = plotRef.current
    if (!plot) {
      return
    }
    const observer = new ResizeObserver(([entry]) =>
      setPlotWidth(entry.contentRect.width),
    )
    observer.observe(plot)
    return () => observer.disconnect()
  }, [])

  // Too narrow for a breakdown beside the pointer: pin it to the plot's
  // left edge at the plot's width, and let its columns wrap.
  const narrow =
    Boolean(describe) && plotWidth > 0 && plotWidth < POPUP_WIDTH * 1.4
  const popupWidth = narrow ? plotWidth : POPUP_WIDTH
  const data = buckets.map((bucket) => ({
    key: bucket.key,
    label: bucket.label,
    title: bucket.title,
    ...Object.fromEntries(
      series.map((s) => [s.key, bucket.values[s.key] ?? 0]),
    ),
  }))

  return (
    <Root>
      <Plot ref={plotRef} style={{ height }}>
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
              width={56}
              allowDecimals={false}
              tickFormatter={formatTick}
              tick={{ fontSize: 12, fill: 'var(--ds-neutral-11)' }}
            />
            <Tooltip
              cursor={{ fill: 'var(--ds-neutral-alpha-3)' }}
              position={narrow ? { x: 0 } : undefined}
              content={({ active, payload }) => {
                if (!active || !payload?.length) {
                  return null
                }

                const row = payload[0].payload as Record<string, number> & {
                  key: string
                  title: string
                }
                const detail = describe?.(row.key)

                if (detail) {
                  return (
                    <Wide data-wide style={{ width: popupWidth }}>
                      <ChartTooltip
                        title={detail.title ?? row.title}
                        rows={detail.rows}
                        sections={detail.sections}
                        note={detail.note}
                        layout="horizontal"
                      />
                    </Wide>
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

/* A breakdown needs a width for its columns to sit side by side; recharts
   keeps the popup inside the chart, and the columns wrap on a narrow one. */
/* Its width is set from the plot, so it never floats out of the card. */
const Wide = styled.div``
