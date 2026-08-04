import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { isProcessKey, toProcessName } from '../lib'

import type { ChartDatum } from '../lib'
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
      <TooltipBox>
        <TipTitle>{label}</TipTitle>
        <TipEmpty>
          {t('dashboard.applicationsUsage.tooltip.loadFailed')}
        </TipEmpty>
      </TooltipBox>
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
      <TooltipBox>
        <TipTitle>{label}</TipTitle>
        <TipEmpty>{t('dashboard.applicationsUsage.tooltip.noData')}</TipEmpty>
      </TooltipBox>
    )
  }

  return (
    <TooltipBox>
      <TipTitle>{label}</TipTitle>
      <TipList>
        {entries.map((entry) => (
          <TipRow key={entry.processName}>
            <TipLeft>
              <Dot $c={entry.color} />
              {entry.processName === OTHER_PROCESS_NAME
                ? t('dashboard.applicationsUsage.tooltip.apps.other')
                : entry.processName}
            </TipLeft>
            <TipVal>{formatDurationFromHoursFloat(entry.value, t)}</TipVal>
          </TipRow>
        ))}
      </TipList>
      <TipDivider />
      <TipTotal>
        <TipTotalLabel>
          {t('dashboard.applicationsUsage.tooltip.total')}
        </TipTotalLabel>
        <TipVal>{formatDurationFromHoursFloat(total, t)}</TipVal>
      </TipTotal>
    </TooltipBox>
  )
}

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

const TipEmpty = styled.div`
  padding: 4px;
  font-size: 14px;
  line-height: 20px;
  color: rgba(0, 7, 20, 0.62);
`

const TipList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 2px 4px 10px;
  max-height: 120px;
  overflow-y: auto;
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
