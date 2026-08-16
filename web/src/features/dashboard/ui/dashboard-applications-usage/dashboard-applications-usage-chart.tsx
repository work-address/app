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

const MAX_LABEL_LENGTH = 12

const truncateLabel = (label: string) =>
  label.length > MAX_LABEL_LENGTH
    ? `${label.slice(0, MAX_LABEL_LENGTH)}…`
    : label

export const DashboardApplicationsUsageChart = ({
  data,
  processNames,
  yAxis,
}: ApplicationsUsageChart) => {
  const isScrollable = data.length > VISIBLE_PROJECTS_COUNT

  return (
    <Root>
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
            margin={{ top: 6, right: 8, left: 0, bottom: 0 }}
          >
            <CartesianGrid vertical={false} strokeDasharray="3 6" />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tickMargin={10}
              interval={0}
              tickFormatter={truncateLabel}
            />
            <YAxis
              domain={[0, yAxis.max]}
              ticks={yAxis.ticks}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => (v === 0 ? '0' : `${v}H`)}
              width={34}
            />
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
    </Root>
  )
}

const Root = styled.div`
  overflow-x: auto;
`

const ChartWrap = styled.div`
  height: 306px;

  .recharts-cartesian-grid-horizontal line {
    stroke: var(--c-rgba-0-0-51-0_12);
  }

  .recharts-text {
    fill: var(--c-rgba-0-7-20-0_62);
    font-size: var(--font-size-1);
  }
`
