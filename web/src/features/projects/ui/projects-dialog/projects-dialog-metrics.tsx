import { Badge, Flex, Grid } from '@radix-ui/themes'
import { type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { getProjectStatusTranslationKey } from '../../model'

import type { ProjectWithStats } from '@/entities/projects'

import {
  BASE_CURRENCY,
  formatAmount,
  formatDurationFromMinutes,
  Text,
  useBreakpoint,
} from '@/shared'

type MetricProps = {
  label: string
  children: ReactNode
}

type ProjectsDialogMetricsProps = {
  data: ProjectWithStats
}

export const ProjectsDialogMetrics = ({ data }: ProjectsDialogMetricsProps) => {
  const { t } = useTranslation()
  const isDesktop = useBreakpoint('isDesktop')
  const statusKey = getProjectStatusTranslationKey(data.state)

  return (
    <Grid
      columns={{ initial: '2', sm: '4' }}
      gap={isDesktop ? '4' : '3'}
      width="100%"
    >
      <Metric label={t('dashboard.projectsTable.head.earnings')}>
        {formatAmount(data.earnings)} {BASE_CURRENCY.code}
      </Metric>
      <Metric label={t('dashboard.projectsTable.head.status')}>
        <Badge color={data.state === 'Active' ? 'green' : 'gray'}>
          {statusKey === null ? data.state : t(statusKey)}
        </Badge>
      </Metric>
      <Metric label={t('dashboard.projectsTable.head.timeTotal')}>
        {formatDurationFromMinutes(data.minutes, t)}
      </Metric>
      <Metric label={t('dashboard.projectsTable.head.timeActive')}>
        <Badge color="green">
          {formatDurationFromMinutes(data.minutesActive, t)}
        </Badge>
      </Metric>
      <Metric label={t('dashboard.projectsTable.head.keyboardKeys')}>
        {data.keyboardKeys}
      </Metric>
      <Metric label={t('dashboard.projectsTable.head.mouseKeys')}>
        {data.mouseKeys}
      </Metric>
      <Metric label={t('dashboard.projectsTable.head.mouseDistance')}>
        {data.mouseDistance}
      </Metric>
    </Grid>
  )
}

const Metric = ({ label, children }: MetricProps) => (
  <Flex direction="column" gap="1" minWidth="0">
    <Text color="gray" size="2">
      {label}
    </Text>
    <Text size="2" weight="medium">
      {children}
    </Text>
  </Flex>
)
