import { Badge, Flex } from '@radix-ui/themes'
import { type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import type { Time } from '@/entities/time'

import { formatDurationFromMinutes, Text } from '@/shared'

type MetricProps = {
  label: string
  children: ReactNode
}

const Metric = ({ label, children }: MetricProps) => (
  <Flex direction="column" gap="1">
    <Text color="gray" size="2">
      {label}
    </Text>
    <Text size="2" weight="medium">
      {children}
    </Text>
  </Flex>
)

type TimeDialogMetricsProps = {
  row: Time
}

export const TimeDialogMetrics = ({ row }: TimeDialogMetricsProps) => {
  const { t } = useTranslation()

  return (
    <>
      <Text size="2" weight="medium">
        {t('dashboard.worklogsTable.head.activeMetrics')}
      </Text>
      <Flex gap="4">
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
      </Flex>
    </>
  )
}
