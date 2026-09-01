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

import {
  getBarColor,
  HIT_AREA_KEY,
  toProcessKey,
  type ApplicationsUsageChart,
} from '../../model'

import { DashboardApplicationsUsageTooltip } from './dashboard-applications-usage-tooltip'

// Projects visible in the chart area before horizontal scroll kicks in.
const VISIBLE_PROJECTS_COUNT = 4

// Chosen so four labels fit the aside's plot width without touching; the full
// name is always available in the tooltip.
const MAX_LABEL_LENGTH = 8

const CHART_HEIGHT = 306
// Vertical bounds of the plot box; the hour gutter outside the scroller must
// use the same numbers to line up with the grid. Keep in sync with the chart
// margin below, the XAxis height, and the skeleton.
const PLOT_TOP = 6
const LABEL_AREA_HEIGHT = 30
// The gutter sizes itself to its own widest tick (see YAxisSizer) instead of
// reserving a fixed width for the longest localized tick ("100小时", "100時間"),
// which left the aside's plot paying for space no English scale ever used.
// This is only the floor, shared with the skeleton and the empty state.
const Y_AXIS_MIN_WIDTH = 28
// Gap between a tick label and the plot.
const Y_AXIS_GAP = 6

const truncateLabel = (label: string) =>
  label.length > MAX_LABEL_LENGTH
    ? `${label.slice(0, MAX_LABEL_LENGTH)}…`
    : label

export const DashboardApplicationsUsageChart = ({
  data,
  processNames,
  yAxis,
}: ApplicationsUsageChart) => {
  const { t } = useTranslation()
  const isScrollable = data.length > VISIBLE_PROJECTS_COUNT

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
          style={
            isScrollable
              ? {
                  width: `${(data.length / VISIBLE_PROJECTS_COUNT) * 100}%`,
                }
              : undefined
          }
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: PLOT_TOP, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid vertical={false} strokeDasharray="3 6" />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tickMargin={10}
                interval={0}
                height={LABEL_AREA_HEIGHT}
                tickFormatter={truncateLabel}
              />
              <YAxis domain={[0, yAxis.max]} ticks={yAxis.ticks} hide />
              <Tooltip
                content={<DashboardApplicationsUsageTooltip />}
                cursor={{ fill: 'var(--c-rgba-0-52-130-0_06)' }}
                wrapperStyle={{ pointerEvents: 'auto' }}
              />
              {processNames.length > 0 ? (
                processNames.map((processName, index) => (
                  <Bar
                    key={processName}
                    dataKey={toProcessKey(processName)}
                    stackId="x"
                    fill={getBarColor(processName, index)}
                    maxBarSize={80}
                    background={index === 0 ? { fill: 'transparent' } : false}
                    radius={
                      index === processNames.length - 1
                        ? [8, 8, 0, 0]
                        : [0, 0, 0, 0]
                    }
                  />
                ))
              ) : (
                <Bar
                  dataKey={HIT_AREA_KEY}
                  fill="transparent"
                  maxBarSize={80}
                  background={{ fill: 'transparent' }}
                  isAnimationActive={false}
                  legendType="none"
                />
              )}
            </BarChart>
          </ResponsiveContainer>
        </ChartWrap>
      </Scroller>
    </Root>
  )
}

const Root = styled.div`
  display: flex;
  height: ${CHART_HEIGHT}px;
`

const YAxisGutter = styled.div`
  position: relative;
  flex: none;
  min-width: ${Y_AXIS_MIN_WIDTH}px;
  margin: ${PLOT_TOP}px 0 ${LABEL_AREA_HEIGHT}px;
`

const YAxisSizer = styled.span`
  visibility: hidden;
  display: block;
  padding-right: ${Y_AXIS_GAP}px;
  font-size: var(--font-size-1);
  line-height: 1;
  white-space: nowrap;
`

const YAxisLabel = styled.span`
  position: absolute;
  right: ${Y_AXIS_GAP}px;
  white-space: nowrap;
  transform: translateY(-50%);
  color: var(--c-rgba-0-7-20-0_62);
  font-size: var(--font-size-1);
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
    stroke: var(--c-rgba-0-0-51-0_12);
  }

  .recharts-text {
    fill: var(--c-rgba-0-7-20-0_62);
    font-size: var(--font-size-1);
  }
`
