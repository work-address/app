import { Badge, Flex, Grid } from '@radix-ui/themes'
import { type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { getProjectStatusTranslationKey } from '../../model'

import type { ProjectWithStats } from '@/entities/projects'

import {
  formatCount,
  formatCurrency,
  formatDurationFromMinutes,
  Hint,
  Text,
  useBreakpoint,
} from '@/shared'

type MetricProps = {
  label: string
  description?: string
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
      <Metric
        label={t('dashboard.projectsTable.head.paid')}
        description={t('common.metricDesc.paid')}
      >
        {formatCurrency(data.paid)}
      </Metric>
      <Metric label={t('dashboard.projectsTable.head.status')}>
        <Badge color={data.state === 'Active' ? 'green' : 'gray'}>
          {statusKey === null ? data.state : t(statusKey)}
        </Badge>
      </Metric>
      <Metric
        label={t('dashboard.projectsTable.head.timeTotal')}
        description={t('common.metricDesc.timeTotal')}
      >
        {formatDurationFromMinutes(data.minutes, t)}
      </Metric>
      <Metric
        label={t('dashboard.projectsTable.head.timeActive')}
        description={t('common.metricDesc.timeActive')}
      >
        <Badge color="green">
          {formatDurationFromMinutes(data.minutesActive, t)}
        </Badge>
      </Metric>
      <Metric
        label={t('dashboard.projectsTable.head.keyboardKeys')}
        description={t('common.metricDesc.keyboard')}
      >
        {formatCount(data.keyboardKeys)}
      </Metric>
      <Metric
        label={t('dashboard.projectsTable.head.mouseKeys')}
        description={t('common.metricDesc.mouse')}
      >
        {formatCount(data.mouseKeys)}
      </Metric>
      <Metric
        label={t('dashboard.projectsTable.head.mouseDistance')}
        description={t('common.metricDesc.mouseDistance')}
      >
        {formatCount(data.mouseDistance)}
      </Metric>
    </Grid>
  )
}

const Metric = ({ label, description, children }: MetricProps) => (
  <Flex direction="column" gap="1" minWidth="0">
    <Flex align="center" gap="1">
      <Text color="gray" size="2">
        {label}
      </Text>
      {description && <Hint content={description} size={13} />}
    </Flex>
    <Text size="2" weight="medium">
      {children}
    </Text>
  </Flex>
)
