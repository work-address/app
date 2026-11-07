import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
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

import {
  HIT_AREA_KEY,
  toProcessKey,
  type ApplicationsUsageChart,
} from '../../model'
import { DashboardProjectPopup } from '../dashboard-project-popup'

import { OTHER_PROCESS_NAME } from '@/entities/projects'
import { ChartPopup, workspaceDesign } from '@/shared'

// Projects visible in the chart area before horizontal scroll kicks in.
const VISIBLE_PROJECTS_COUNT = 4

// Chosen so four labels fit the aside's plot width without touching; the full
// name is always available in the tooltip.
const MAX_LABEL_LENGTH = 8

const APP_COLORS = [
  'var(--ui-chart-1)',
  'var(--ui-chart-2)',
  'var(--ui-chart-3)',
  'var(--ui-chart-5)',
]

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
  const rootRef = useRef<HTMLDivElement>(null)
  // The hovered project, whose popup opens beside the chart, over the table.
  const [active, setActive] = useState<number | null>(null)
  const hovered = active === null ? undefined : data[active]
  const isScrollable = data.length > VISIBLE_PROJECTS_COUNT

  return (
    <Root ref={rootRef}>
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
              margin={{
                top: workspaceDesign.chart.plotTop,
                right: workspaceDesign.chart.plotRight,
                left: 0,
                bottom: 0,
              }}
              onMouseMove={(state) => {
                const index = Number(state?.activeTooltipIndex)
                setActive(Number.isInteger(index) ? index : null)
              }}
              onMouseLeave={() => setActive(null)}
            >
              <CartesianGrid vertical={false} stroke="var(--ui-line)" />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tickMargin={workspaceDesign.chart.tickMargin}
                interval={0}
                height={workspaceDesign.chart.labelAreaHeight}
                tickFormatter={truncateLabel}
              />
              <YAxis domain={[0, yAxis.max]} ticks={yAxis.ticks} hide />
              {/* Only the bar highlight: the project's popup is its own. */}
              <Tooltip
                content={() => null}
                cursor={{ fill: 'var(--ui-inset)' }}
              />
              {processNames.length > 0 ? (
                <BarStack
                  stackId="x"
                  radius={[
                    workspaceDesign.chart.barRadius,
                    workspaceDesign.chart.barRadius,
                    workspaceDesign.chart.barBaseRadius,
                    workspaceDesign.chart.barBaseRadius,
                  ]}
                >
                  {processNames.map((processName, index) => (
                    <Bar
                      key={processName}
                      dataKey={toProcessKey(processName)}
                      stackId="x"
                      fill={
                        processName === OTHER_PROCESS_NAME
                          ? 'var(--ui-chart-7)'
                          : APP_COLORS[index]
                      }
                      maxBarSize={workspaceDesign.chart.barMaxWidth}
                      stroke="var(--ui-surface)"
                      strokeWidth={workspaceDesign.border.width}
                      background={index === 0 ? { fill: 'transparent' } : false}
                      isAnimationActive={false}
                    />
                  ))}
                </BarStack>
              ) : (
                <Bar
                  dataKey={HIT_AREA_KEY}
                  fill="transparent"
                  maxBarSize={workspaceDesign.chart.barMaxWidth}
                  background={{ fill: 'transparent' }}
                  isAnimationActive={false}
                  legendType="none"
                />
              )}
            </BarChart>
          </ResponsiveContainer>
        </ChartWrap>
      </Scroller>
      {hovered?.projectId ? (
        <ChartPopup
          anchor={() => rootRef.current?.getBoundingClientRect()}
          gap={workspaceDesign.chart.popupGap}
          width={workspaceDesign.chart.popupWidth}
        >
          <DashboardProjectPopup projectId={hovered.projectId} />
        </ChartPopup>
      ) : null}
    </Root>
  )
}

const Root = styled.div`
  position: relative;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  height: 100%;
  min-height: var(--ui-chart-min-height);
`

const YAxisGutter = styled.div`
  position: relative;
  min-width: var(--ui-chart-y-axis-min-width);
  margin: var(--ui-chart-plot-top) 0 var(--ui-chart-label-area-height);
`

const YAxisSizer = styled.span`
  visibility: hidden;
  display: block;
  padding-right: var(--ui-chart-y-axis-gap);
  font-size: var(--ui-meta-size);
  line-height: var(--ui-chart-label-leading);
  white-space: nowrap;
`

const YAxisLabel = styled.span`
  position: absolute;
  right: var(--ui-chart-y-axis-gap);
  white-space: nowrap;
  transform: translateY(-50%);
  color: var(--ui-muted);
  font-size: var(--ui-meta-size);
  line-height: var(--ui-chart-label-leading);
`

const Scroller = styled.div`
  min-width: 0;
  overflow-x: auto;
`

const ChartWrap = styled.div`
  height: 100%;

  .recharts-text {
    fill: var(--ui-muted);
    font-size: var(--ui-meta-size);
  }
`
