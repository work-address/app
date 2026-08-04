import { useUnit } from 'effector-react'
import { useEffect, useMemo, useState } from 'react'

import { buildApplicationsUsageChart, PERIOD_TO_STATS_PERIOD } from '../lib'

import { DashboardApplicationsUsageCard } from './dashboard-applications-usage-card'
import { DashboardApplicationsUsageChart } from './dashboard-applications-usage-chart'

import type { Period } from '../lib'

import {
  $projectsLoading,
  $projectsProcessStats,
  $projectsProcessStatsLoading,
  $projectsWithProcessTracking,
  fetchProjectsProcessStats,
} from '@/entities/projects'

export const DashboardApplicationsUsage = () => {
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

  return (
    <DashboardApplicationsUsageCard
      period={period}
      isLoading={isLoading}
      onPeriodChange={setPeriod}
    >
      <DashboardApplicationsUsageChart {...chart} />
    </DashboardApplicationsUsageCard>
  )
}
