import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { isProcessKey, toProcessName, type ChartDatum } from '../../model'

import type { TooltipContentProps } from 'recharts'
import type {
  ValueType,
  NameType,
} from 'recharts/types/component/DefaultTooltipContent'

import { OTHER_PROCESS_NAME } from '@/entities/projects'
import { formatDurationFromHoursFloat } from '@/shared'

export const DashboardApplicationsUsageTooltip = ({
  active,
  payload,
  label,
}: Partial<TooltipContentProps<ValueType, NameType>>) => {
  const { t } = useTranslation()

  if (!active) {
    return null
  }

  const row = payload?.[0]?.payload as ChartDatum | undefined

  if (row?.failed) {
    return (
      <Root>
        <Title>{label}</Title>
        <Placeholder>
          {t('dashboard.applicationsUsage.tooltip.loadFailed')}
        </Placeholder>
      </Root>
    )
  }

  const entries = (payload ?? [])
    .filter((entry) => isProcessKey(String(entry?.dataKey ?? '')))
    .map((entry) => ({
      processName: toProcessName(String(entry.dataKey)),
      value: Number(entry.value ?? 0),
      color: entry.color ?? '',
    }))
    .filter((entry) => entry.value > 0)

  const total = entries.reduce((acc, entry) => acc + entry.value, 0)

  if (!row?.hasData || total === 0) {
    return (
      <Root>
        <Title>{label}</Title>
        <Placeholder>
          {t('dashboard.applicationsUsage.tooltip.noData')}
        </Placeholder>
      </Root>
    )
  }

  return (
    <Root>
      <Title>{label}</Title>
      <List>
        {entries.map((entry) => (
          <Row key={entry.processName}>
            <Label>
              <Swatch $c={entry.color} />
              {entry.processName === OTHER_PROCESS_NAME
                ? t('dashboard.applicationsUsage.tooltip.apps.other')
                : entry.processName}
            </Label>
            <Value>{formatDurationFromHoursFloat(entry.value, t)}</Value>
          </Row>
        ))}
      </List>
      <Divider />
      <Total>
        <TotalLabel>
          {t('dashboard.applicationsUsage.tooltip.total')}
        </TotalLabel>
        <Value>{formatDurationFromHoursFloat(total, t)}</Value>
      </Total>
    </Root>
  )
}

const Root = styled.div`
  background: var(--white);
  border: 1px solid var(--c-rgba-0-0-51-0_12);
  border-radius: 10px;
  padding: 8px 10px;
  box-shadow: 0 1px 6px var(--c-rgba-0-0-0-0_08);
  color: var(--ds-neutral-12);
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

const Title = styled.div`
  font-weight: 600;
  font-size: 16px;
  line-height: 20px;
  padding: 4px 4px 8px;
`

const Placeholder = styled.div`
  padding: 4px;
  font-size: 14px;
  line-height: 20px;
  color: var(--c-rgba-0-7-20-0_62);
`

const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 2px 4px 10px;
  max-height: 120px;
  overflow-y: auto;
`

const Row = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
`

const Label = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: var(--c-rgba-0-7-20-0_82);
  font-size: 14px;
`

// Per-series swatch color comes from the chart's bounded palette at runtime
// (see getBarColor in ../../model); it can't be expressed as a fixed data-*
// variant since the mapping is data-driven, not a UI state.
const Swatch = styled.span<{ $c: string }>`
  width: 12px;
  height: 12px;
  border-radius: 999px;
  background: ${(p) => p.$c};
`

const Value = styled.div`
  font-weight: 600;
  font-size: 16px;
  line-height: 20px;
  color: var(--c-rgba-0-7-20-0_88);
`

const Divider = styled.div`
  height: 1px;
  background: var(--c-rgba-0-0-51-0_12);
  margin: 6px 4px 8px;
`

const Total = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px;
`

const TotalLabel = styled.div`
  font-size: 14px;
  color: var(--c-rgba-0-7-20-0_62);
`
