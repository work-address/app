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
import {
  statisticsOverviewQuery,
  statisticsProjectAppsQuery,
} from '@/entities/statistics'

export const DashboardApplicationsUsage = () => {
  const { t } = useTranslation()

  const { selectedProjects, projectsLoading, rows, pending, failed, totals } =
    useUnit({
      selectedProjects: $dashboardProjects,
      projectsLoading: $projectsLoading,
      rows: statisticsProjectAppsQuery.$data,
      pending: statisticsProjectAppsQuery.$pending,
      failed: statisticsProjectAppsQuery.$failed,
      totals: statisticsOverviewQuery.$data,
    })

  // Projects with the most app time first, so a long list never opens on
  // empty bars; the rest keep their order after them.
  const projects = useMemo(() => {
    const seconds = new Map<string, number>()

    for (const row of rows ?? []) {
      seconds.set(
        row.projectId,
        (seconds.get(row.projectId) ?? 0) + row.seconds,
      )
    }

    return selectedProjects
      .filter((project) => project.trackProcesses)
      .map((project, index) => ({ project, index }))
      .sort(
        (a, b) =>
          (seconds.get(b.project.id ?? '') ?? 0) -
            (seconds.get(a.project.id ?? '') ?? 0) || a.index - b.index,
      )
      .map(({ project }) => project)
  }, [selectedProjects, rows])

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
  // Tracked hours without app rows are a different story again: apps stay
  // private until an entry is past its review window (and manual entries
  // never have any), so the period has time in it that is not yet - or not
  // ever - broken down here.
  const hasTrackedTime = (totals ?? []).some((row) => row.trackedSeconds > 0)
  const emptyKey =
    projects.length === 0
      ? 'trackingOff'
      : hasTrackedTime
        ? 'pendingReview'
        : 'noActivity'

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
