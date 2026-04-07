import { useMemo, useState } from 'react'
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

import { MotionSelect, Card } from '@/features/shared'

type Period = 'Week' | 'Month' | 'Year'

type BarDatum = {
  label: string
  firefox: number
  figma: number
  terminal: number
  zoom: number
}

function formatDuration(hoursFloat: number) {
  const totalMin = Math.round(hoursFloat * 60)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h <= 0) {
    return `${m}m`
  }
  return `${h}h ${m}m`
}

function CustomTooltip({ active, payload, label }: any) {
  const { t } = useTranslation()

  if (!active || !payload?.length) return null
  const byKey: Record<string, number> = {}
  for (const p of payload) {
    if (p?.dataKey) {
      byKey[p.dataKey] = p.value ?? 0
    }
  }

  const entries = [
    {
      key: 'firefox',
      name: t('dashboard.applicationsUsage.tooltip.apps.firefox'),
    },
    { key: 'figma', name: t('dashboard.applicationsUsage.tooltip.apps.figma') },
    {
      key: 'terminal',
      name: t('dashboard.applicationsUsage.tooltip.apps.terminal'),
    },
    { key: 'zoom', name: t('dashboard.applicationsUsage.tooltip.apps.zoom') },
  ]

  const colors: Record<string, string> = {
    firefox: 'var(--c-rgba-0-52-130-0_75)',
    figma: 'var(--c-rgba-0-52-130-0_50)',
    terminal: 'var(--c-rgba-0-52-130-0_28)',
    zoom: 'var(--c-rgba-0-52-130-0_14)',
  }

  const total = entries.reduce((acc, e) => acc + (byKey[e.key] ?? 0), 0)
  return (
    <TooltipBox>
      <TipTitle>{label}</TipTitle>
      <TipList>
        {entries.map((e) => (
          <TipRow key={e.key}>
            <TipLeft>
              <Dot $c={colors[e.key]} />
              {e.name}
            </TipLeft>
            <TipVal>{formatDuration(byKey[e.key] ?? 0)}</TipVal>
          </TipRow>
        ))}
      </TipList>
      <TipDivider />
      <TipTotal>
        <TipTotalLabel>
          {t('dashboard.applicationsUsage.tooltip.total')}
        </TipTotalLabel>
        <TipVal>{formatDuration(total)}</TipVal>
      </TipTotal>
    </TooltipBox>
  )
}

export default function ApplicationsUsage() {
  const { t } = useTranslation()
  const [period, setPeriod] = useState<Period>('Week')

  const data = useMemo<BarDatum[]>(() => {
    const projectLabel = (n: number) =>
      t('dashboard.applicationsUsage.project', { number: n })

    if (period === 'Month') {
      return [
        {
          label: projectLabel(1),
          firefox: 0.8,
          figma: 1.1,
          terminal: 1.0,
          zoom: 0.8,
        },
        {
          label: projectLabel(2),
          firefox: 1.4,
          figma: 1.7,
          terminal: 1.1,
          zoom: 0.9,
        },
        {
          label: projectLabel(3),
          firefox: 1.2,
          figma: 2.1,
          terminal: 1.0,
          zoom: 0.7,
        },
        {
          label: projectLabel(4),
          firefox: 1.1,
          figma: 1.5,
          terminal: 1.0,
          zoom: 0.8,
        },
      ]
    }

    if (period === 'Year') {
      return [
        {
          label: projectLabel(1),
          firefox: 1.1,
          figma: 1.3,
          terminal: 1.2,
          zoom: 0.9,
        },
        {
          label: projectLabel(2),
          firefox: 1.8,
          figma: 2.0,
          terminal: 1.3,
          zoom: 1.1,
        },
        {
          label: projectLabel(3),
          firefox: 1.7,
          figma: 2.6,
          terminal: 1.1,
          zoom: 0.8,
        },
        {
          label: projectLabel(4),
          firefox: 1.6,
          figma: 2.0,
          terminal: 1.2,
          zoom: 1.0,
        },
      ]
    }

    return [
      {
        label: projectLabel(1),
        firefox: 0.7,
        figma: 0.9,
        terminal: 0.8,
        zoom: 0.6,
      },
      {
        label: projectLabel(2),
        firefox: 2.8,
        figma: 1.55,
        terminal: 0.88,
        zoom: 0.45,
      },
      {
        label: projectLabel(3),
        firefox: 1.4,
        figma: 2.1,
        terminal: 1.0,
        zoom: 0.6,
      },
      {
        label: projectLabel(4),
        firefox: 1.2,
        figma: 1.0,
        terminal: 1.1,
        zoom: 0.7,
      },
    ]
  }, [period, t])

  return (
    <Wrapper>
      <Head>
        <Title>{t('dashboard.applicationsUsage.title')}</Title>
        <PeriodSelect>
          <MotionSelect
            options={[
              {
                value: 'Week',
                label: t('dashboard.applicationsUsage.period.week'),
              },
              {
                value: 'Month',
                label: t('dashboard.applicationsUsage.period.month'),
              },
              {
                value: 'Year',
                label: t('dashboard.applicationsUsage.period.year'),
              },
            ]}
            value={period}
            onChange={(v) => setPeriod(v as Period)}
          />
        </PeriodSelect>
      </Head>

      <StyledCard>
        <Plot>
          <ChartWrap>
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
                />
                <YAxis
                  domain={[0, 10]}
                  ticks={[0, 2, 4, 6, 8, 10]}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => (v === 0 ? '0' : `${v}H`)}
                  width={34}
                />
                <Tooltip
                  content={<CustomTooltip />}
                  cursor={{ fill: 'var(--c-rgba-0-52-130-0_06)' }}
                />
                <Bar
                  dataKey="firefox"
                  stackId="x"
                  fill="var(--c-rgba-0-52-130-0_75)"
                  barSize={80}
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="figma"
                  stackId="x"
                  fill="var(--c-rgba-0-52-130-0_50)"
                  barSize={80}
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="terminal"
                  stackId="x"
                  fill="var(--c-rgba-0-52-130-0_28)"
                  barSize={80}
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="zoom"
                  stackId="x"
                  fill="var(--c-rgba-0-52-130-0_14)"
                  barSize={80}
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartWrap>
        </Plot>
      </StyledCard>
    </Wrapper>
  )
}

const Wrapper = styled.aside`
  width: 100%;
`

const Head = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 25px;
`

const Title = styled.h2`
  font-weight: 500;
  font-size: 24px;
  line-height: 125%;
  letter-spacing: 0em;
  color: var(--ds-primary);
`

const PeriodSelect = styled.div`
  width: 120px;

  button {
    height: 32px;
  }
`

const StyledCard = styled(Card)`
  padding: 12px 12px 14px;
`

const Plot = styled.div`
  position: relative;
  padding: 10px;
  border-radius: 10px;
  background: var(--white);
`

const ChartWrap = styled.div`
  height: 306px;

  .recharts-cartesian-grid-horizontal line {
    stroke: var(--c-rgba-0-0-51-0_12);
  }

  .recharts-text {
    fill: var(--c-rgba-0-7-20-0_62);
    font-size: 12px;
  }
`

const TooltipBox = styled.div`
  background: var(--white);
  border: 1px solid var(--c-rgba-0-0-51-0_12);
  border-radius: 10px;
  padding: 8px 10px;
  box-shadow: 0 1px 6px var(--c-rgba-0-0-0-0_08);
  color: var(--ds-primary);
  font-size: 12px;
  min-width: 200px;
  position: relative;

  &::after {
    content: '';
    position: absolute;
    right: -8px;
    top: 10px;
    width: 0;
    height: 0;
    border-top: 8px solid transparent;
    border-bottom: 8px solid transparent;
    border-left: 8px solid var(--white);
    filter: drop-shadow(0 0 0 var(--c-rgba-0-0-0-0));
  }

  &::before {
    content: '';
    position: absolute;
    right: -10px;
    top: 10px;
    width: 0;
    height: 0;
    border-top: 9px solid transparent;
    border-bottom: 9px solid transparent;
    border-left: 9px solid var(--c-rgba-0-0-51-0_12);
  }
`

const TipTitle = styled.div`
  font-weight: 600;
  font-size: 16px;
  line-height: 20px;
  padding: 4px 4px 8px;
`

const TipList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 2px 4px 10px;
`

const TipRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
`

const TipLeft = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: rgba(0, 7, 20, 0.82);
  font-size: 14px;
`

const Dot = styled.span<{ $c: string }>`
  width: 12px;
  height: 12px;
  border-radius: 999px;
  background: ${(p) => p.$c};
`

const TipVal = styled.div`
  font-weight: 600;
  font-size: 16px;
  line-height: 20px;
  color: rgba(0, 7, 20, 0.88);
`

const TipDivider = styled.div`
  height: 1px;
  background: rgba(0, 0, 51, 0.12);
  margin: 6px 4px 8px;
`

const TipTotal = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px;
`

const TipTotalLabel = styled.div`
  font-size: 14px;
  color: rgba(0, 7, 20, 0.62);
`
