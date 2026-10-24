import { useUnit } from 'effector-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import {
  $dashboardProjects,
  buildApplicationsUsageChart,
  toProjectProcessStats,
} from '../../model'

import { DashboardApplicationsUsageCard } from './dashboard-applications-usage-card'
import { DashboardApplicationsUsageChart } from './dashboard-applications-usage-chart'
import { DashboardApplicationsUsageEmpty } from './dashboard-applications-usage-empty'

import { $projectsLoading } from '@/entities/projects'
import { statisticsProjectAppsQuery } from '@/entities/statistics'

export const DashboardApplicationsUsage = () => {
  const { t } = useTranslation()

  const { selectedProjects, projectsLoading, rows, pending, failed } = useUnit({
    selectedProjects: $dashboardProjects,
    projectsLoading: $projectsLoading,
    rows: statisticsProjectAppsQuery.$data,
    pending: statisticsProjectAppsQuery.$pending,
    failed: statisticsProjectAppsQuery.$failed,
  })

  const projects = useMemo(
    () => selectedProjects.filter((project) => project.trackProcesses),
    [selectedProjects],
  )

  const chart = useMemo(
    () =>
      buildApplicationsUsageChart(
        projects,
        toProjectProcessStats(
          projects.map((project) => project.id ?? ''),
          rows ?? [],
          failed,
        ),
      ),
    [projects, rows, failed],
  )

  // Keep the previous period on screen while refetching; show the placeholder
  // only until there is anything to render.
  const isLoading = projectsLoading || (pending && rows === null)

  // A failed fetch also leaves nothing to stack, but it is not an empty state:
  // those rows keep their bars so the tooltip can say the load failed.
  const hasFailedStats = chart.data.some((datum) => datum.failed)
  const isEmpty = chart.processNames.length === 0 && !hasFailedStats

  // `projects` is already filtered to the ones tracking processes, so an empty
  // list means the feature is off everywhere rather than merely unused so far.
  const emptyKey = projects.length === 0 ? 'trackingOff' : 'noActivity'

  return (
    <DashboardApplicationsUsageCard isLoading={isLoading}>
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
