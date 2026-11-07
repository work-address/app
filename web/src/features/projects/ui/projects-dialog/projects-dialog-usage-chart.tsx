import { useRef, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
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

import type { ProjectUsageChart } from '../../model'
import type { TooltipContentProps } from 'recharts'
import type {
  ValueType,
  NameType,
} from 'recharts/types/component/DefaultTooltipContent'

import { OTHER_PROCESS_NAME } from '@/entities/projects'
import { ChartPopup, formatDurationFromHoursFloat, pointInside } from '@/shared'

// Geometry shared with the dialog's skeleton and empty state so the plot area
// keeps its size whichever of the three is on screen. Keep them in sync.
export const USAGE_CHART_HEIGHT = 260
export const USAGE_PLOT_TOP = 6
export const USAGE_LABEL_AREA_HEIGHT = 30
// The gutter sizes itself to its own widest tick (see YAxisSizer) rather than
// reserving the dashboard's fixed 56px, which left most of the column's scarce
// width empty whenever the scale was small. This is only the floor for a very
// short scale, and what the skeleton and empty state line their grid up with.
export const USAGE_Y_AXIS_MIN_WIDTH = 28
// Gap between a tick label and the plot.
export const USAGE_Y_AXIS_GAP = 6

// Bars visible in the dialog column before horizontal scroll kicks in.
const VISIBLE_BARS_COUNT = 4

// App names are longer than project names and the column is narrower, so this
// truncates harder than the dashboard chart; the tooltip carries the full name.
const MAX_LABEL_LENGTH = 7

// Every bar is one app and is named on the axis, so color carries no extra
// meaning and stays constant across the series.
const BAR_COLOR = 'var(--ui-chart-1)'

export const ProjectsDialogUsageChart = ({
  data,
  yAxis,
}: Pick<ProjectUsageChart, 'data' | 'yAxis'>) => {
  const { t } = useTranslation()
  const plotRef = useRef<HTMLDivElement>(null)
  const isScrollable = data.length > VISIBLE_BARS_COUNT

  const resolveName = (processName: string) =>
    processName === OTHER_PROCESS_NAME
      ? t('dashboard.applicationsUsage.tooltip.apps.other')
      : processName

  const formatTick = (processName: string) => {
    const name = resolveName(processName)

    return name.length > MAX_LABEL_LENGTH
      ? `${name.slice(0, MAX_LABEL_LENGTH)}…`
      : name
  }

  return (
    <Root>
      {/* Rendered outside the scroller so the hour scale stays put while the
          bars scroll; the in-chart axis is hidden but still owns the domain. */}
      <YAxisGutter aria-hidden>
        {/* In flow and hidden: gives the gutter the exact width of its widest
            tick, in whatever locale, without measuring anything. */}
        <YAxisSizer>
          {t('dashboard.applicationsUsage.axis.hours', { value: yAxis.max })}
        </YAxisSizer>
        {yAxis.ticks.map((tick) => (
          <YAxisLabel
            key={tick}
            style={{ top: `${100 - (tick / yAxis.max) * 100}%` }}
          >
            {tick === 0
              ? '0'
              : t('dashboard.applicationsUsage.axis.hours', { value: tick })}
          </YAxisLabel>
        ))}
      </YAxisGutter>
      <Scroller>
        <ChartWrap
          ref={plotRef}
          style={
            isScrollable
              ? { width: `${(data.length / VISIBLE_BARS_COUNT) * 100}%` }
              : undefined
          }
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: USAGE_PLOT_TOP, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid vertical={false} strokeDasharray="3 6" />
              <XAxis
                dataKey="processName"
                axisLine={false}
                tickLine={false}
                tickMargin={10}
                interval={0}
                height={USAGE_LABEL_AREA_HEIGHT}
                tickFormatter={formatTick}
              />
              <YAxis domain={[0, yAxis.max]} ticks={yAxis.ticks} hide />
              {/* KNOWN ISSUE: on recharts 3.10 this chart stops drawing its
                  bars while the pointer is inside the plot, tooltip or not.
                  The dashboard's stacked chart is not affected and the cause is
                  not yet identified, so the tooltip stays — it is what carries
                  the full app name behind a truncated axis label. */}
              <Tooltip
                content={<ProjectsDialogUsageTooltip plotRef={plotRef} />}
                cursor={{ fill: 'var(--ui-alpha-3)' }}
              />
              {/* One series colored per bar through `shape`: recharts takes
                  only a single fill per series, and <Cell> children stop <Bar>
                  from rendering at all on v3. */}
              <Bar
                dataKey="hours"
                stackId="x"
                fill={BAR_COLOR}
                maxBarSize={64}
                radius={[8, 8, 0, 0]}
                background={{ fill: 'transparent' }}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartWrap>
      </Scroller>
    </Root>
  )
}

const ProjectsDialogUsageTooltip = ({
  active,
  payload,
  coordinate,
  plotRef,
}: Partial<TooltipContentProps<ValueType, NameType>> & {
  plotRef: RefObject<HTMLDivElement | null>
}) => {
  const { t } = useTranslation()

  const datum = payload?.[0]?.payload as
    | { processName: string; hours: number }
    | undefined

  if (!active || !datum) {
    return null
  }

  return (
    <ChartPopup anchor={() => pointInside(plotRef.current, coordinate)}>
      <TooltipRoot role="tooltip">
        <TooltipTitle>
          {datum.processName === OTHER_PROCESS_NAME
            ? t('dashboard.applicationsUsage.tooltip.apps.other')
            : datum.processName}
        </TooltipTitle>
        <TooltipValue>
          {formatDurationFromHoursFloat(datum.hours, t)}
        </TooltipValue>
      </TooltipRoot>
    </ChartPopup>
  )
}

const Root = styled.div`
  display: flex;
  height: ${USAGE_CHART_HEIGHT}px;
`

const YAxisGutter = styled.div`
  position: relative;
  flex: none;
  min-width: ${USAGE_Y_AXIS_MIN_WIDTH}px;
  margin: ${USAGE_PLOT_TOP}px 0 ${USAGE_LABEL_AREA_HEIGHT}px;
`

const YAxisSizer = styled.span`
  visibility: hidden;
  display: block;
  padding-right: ${USAGE_Y_AXIS_GAP}px;
  font-size: var(--ui-small-size);
  line-height: 1;
  white-space: nowrap;
`

const YAxisLabel = styled.span`
  position: absolute;
  right: ${USAGE_Y_AXIS_GAP}px;
  white-space: nowrap;
  transform: translateY(-50%);
  color: var(--ui-muted);
  font-size: var(--ui-small-size);
  line-height: 1;
`

const Scroller = styled.div`
  flex: 1;
  min-width: 0;
  overflow-x: auto;
`

const ChartWrap = styled.div`
  height: 100%;

  .recharts-cartesian-grid-horizontal line {
    stroke: var(--ui-line);
  }

  .recharts-text {
    fill: var(--ui-muted);
    font-size: var(--ui-small-size);
  }

  .recharts-surface {
    outline: none;
  }
`

const TooltipRoot = styled.div`
  background: var(--ui-surface);
  border: var(--ui-border-width) solid var(--ui-line);
  border-radius: var(--ui-control-radius);
  padding: var(--ui-space-2) var(--ui-space-3);
  box-shadow: var(--ui-shadow);
  color: var(--ui-ink);
`

const TooltipTitle = styled.div`
  font-size: var(--ui-meta-size);
  line-height: 20px;
  color: var(--ui-text);
`

const TooltipValue = styled.div`
  font-weight: 600;
  font-size: var(--ui-meta-size);
  line-height: 20px;
  font-variant-numeric: tabular-nums;
`
