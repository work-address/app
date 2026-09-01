import { useUnit } from 'effector-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  buildApplicationsUsageChart,
  PERIOD_TO_STATS_PERIOD,
  type Period,
} from '../../model'

import { DashboardApplicationsUsageCard } from './dashboard-applications-usage-card'
import { DashboardApplicationsUsageChart } from './dashboard-applications-usage-chart'
import { DashboardApplicationsUsageEmpty } from './dashboard-applications-usage-empty'

import {
  $projectsLoading,
  $projectsProcessStats,
  $projectsProcessStatsLoading,
  $projectsWithProcessTracking,
  fetchProjectsProcessStats,
} from '@/entities/projects'

export const DashboardApplicationsUsage = () => {
  const { t } = useTranslation()
  const [period, setPeriod] = useState<Period>('Month')

  const {
    projects,
    projectsLoading,
    processStats,
    processStatsLoading,
    fetchProcessStats,
  } = useUnit({
    projects: $projectsWithProcessTracking,
    projectsLoading: $projectsLoading,
    processStats: $projectsProcessStats,
    processStatsLoading: $projectsProcessStatsLoading,
    fetchProcessStats: fetchProjectsProcessStats,
  })

  const projectIdsKey = useMemo(
    () => projects.map((project) => project.id).join(','),
    [projects],
  )

  useEffect(() => {
    if (projectIdsKey) {
      fetchProcessStats(PERIOD_TO_STATS_PERIOD[period])
    }
  }, [projectIdsKey, period, fetchProcessStats])

  const chart = useMemo(
    () => buildApplicationsUsageChart(projects, processStats),
    [projects, processStats],
  )

  // Keep the previous period on screen while refetching; show the placeholder only
  // until we have any stats to render.
  const isLoading =
    projectsLoading || (processStatsLoading && processStats.length === 0)

  // A failed fetch also leaves nothing to stack, but it is not an empty state:
  // those rows keep their bars so the tooltip can say the load failed.
  const hasFailedStats = chart.data.some((datum) => datum.failed)
  const isEmpty = chart.processNames.length === 0 && !hasFailedStats

  // `projects` is already filtered to the ones tracking processes, so an empty
  // list means the feature is off everywhere rather than merely unused so far.
  const emptyKey = projects.length === 0 ? 'trackingOff' : 'noActivity'

  return (
    <DashboardApplicationsUsageCard
      period={period}
      isLoading={isLoading}
      onPeriodChange={setPeriod}
    >
      {isEmpty ? (
        <DashboardApplicationsUsageEmpty
          title={t(`dashboard.applicationsUsage.empty.${emptyKey}.title`)}
          description={t(
            `dashboard.applicationsUsage.empty.${emptyKey}.description`,
          )}
        />
      ) : (
        <DashboardApplicationsUsageChart {...chart} />
      )}
    </DashboardApplicationsUsageCard>
  )
}
