import { Badge } from '@radix-ui/themes'
import { type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import type { Time } from '@/entities/time'

import { formatDurationFromMinutes, Text } from '@/shared'

type TimeDialogMetricsProps = {
  row: Time
}

export const TimeDialogMetrics = ({ row }: TimeDialogMetricsProps) => {
  const { t } = useTranslation()

  return (
    <Root>
      <Text size="2" weight="medium">
        {t('dashboard.worklogsTable.head.activeMetrics')}
      </Text>
      <MetricsGrid>
        <Metric label={t('dashboard.worklogsTable.head.timeActive')}>
          <Badge color="green">
            {formatDurationFromMinutes(row.minutesActive, t)}
          </Badge>
        </Metric>
        <Metric label={t('dashboard.worklogsTable.head.keyboard')}>
          {row.keyboardKeys}
        </Metric>
        <Metric label={t('dashboard.worklogsTable.head.mouse')}>
          {row.mouseKeys}
        </Metric>
        <Metric label={t('dashboard.worklogsTable.head.mouseDistance')}>
          {row.mouseDistance}
        </Metric>
      </MetricsGrid>
    </Root>
  )
}

type MetricProps = {
  label: string
  children: ReactNode
}

const Metric = ({ label, children }: MetricProps) => (
  <MetricItem>
    <Text color="gray" size="2">
      {label}
    </Text>
    <Text size="2" weight="medium">
      {children}
    </Text>
  </MetricItem>
)

const Root = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  width: 100%;
`

const MetricsGrid = styled.div`
  display: flex;
  gap: var(--space-4);

  ${(p) => p.theme.breakpoints.down('md')} {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3) var(--space-4);
  }
`

const MetricItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 0;
`
