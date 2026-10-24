import { useUnit } from 'effector-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import {
  $dashboardProjects,
  dashboardStatisticsRequested,
} from '../../model/dashboard-filters'

import { $hasProjects, $projectsLoading } from '@/entities/projects'
import { statisticsOverviewQuery } from '@/entities/statistics'
import {
  formatCurrency,
  formatDurationFromMinutes,
  LoadFailure,
  StatStrip,
  StatTile,
} from '@/shared'

/**
 * The four numbers a freelancer opens the dashboard for: how much they have
 * worked in the period, how much of that was real activity, what has been
 * paid for and what has not. Summed over the projects the filter selects,
 * whatever tab or search is applied below - the strip is the whole picture,
 * the table is the detail.
 */
export const DashboardSummary = () => {
  const { t } = useTranslation()

  const {
    projects,
    rows,
    pending,
    failed,
    retry,
    projectsLoading,
    hasProjects,
  } = useUnit({
    projects: $dashboardProjects,
    rows: statisticsOverviewQuery.$data,
    pending: statisticsOverviewQuery.$pending,
    failed: statisticsOverviewQuery.$failed,
    retry: dashboardStatisticsRequested,
    projectsLoading: $projectsLoading,
    hasProjects: $hasProjects,
  })

  const totals = useMemo(() => {
    const rates = new Map(
      projects.map((project) => [project.id, Number(project.rateHour) || 0]),
    )
    const acc = {
      minutes: 0,
      minutesActive: 0,
      minutesPaid: 0,
      minutesUnpaid: 0,
      paid: 0,
      unpaid: 0,
      // A project the reader only views comes without its detail; the
      // activity and money tiles leave it out rather than count it as zero.
      hasDetail: false,
    }

    for (const row of rows ?? []) {
      acc.minutes += row.trackedSeconds / 60

      if (row.paidSeconds === undefined) {
        continue
      }

      // Priced at each project's own rate, so a cheap project's backlog
      // does not get valued at an expensive one's rate.
      const rate = rates.get(row.projectId) ?? 0
      const paid = row.paidSeconds / 60
      const unpaid = Math.max(0, row.trackedSeconds / 60 - paid)

      acc.hasDetail = true
      acc.minutesActive += (row.activeSeconds ?? 0) / 60
      acc.minutesPaid += paid
      acc.minutesUnpaid += unpaid
      acc.paid += (paid * rate) / 60
      acc.unpaid += (unpaid * rate) / 60
    }

    return acc
  }, [projects, rows])

  // Nothing to sum until there is a project; the empty state below the title
  // already says so.
  if (!projectsLoading && !hasProjects) {
    return null
  }

  if (failed) {
    return (
      <LoadFailure
        title={t('dashboard.summary.failure.title')}
        onRetry={retry}
      />
    )
  }

  // Refetching for a new period keeps the old figures until the new ones land.
  const loading = projectsLoading || (pending && rows === null)
  const showDetail = loading || totals.hasDetail || (rows ?? []).length === 0

  const activePercent =
    totals.minutes > 0
      ? Math.round((totals.minutesActive / totals.minutes) * 100)
      : 0

  return (
    <StatStrip>
      <StatTile
        label={t('dashboard.summary.tracked.label')}
        value={formatDurationFromMinutes(Math.round(totals.minutes), t)}
        hint={t('dashboard.summary.tracked.hint', {
          projects: t('dashboard.page.projectsCount', {
            count: projects.length,
          }),
        })}
        loading={loading}
      />
      {showDetail && (
        <>
          <StatTile
            tone="accent"
            label={t('dashboard.summary.active.label')}
            value={formatDurationFromMinutes(
              Math.round(totals.minutesActive),
              t,
            )}
            hint={t('dashboard.summary.active.hint', {
              percent: activePercent,
            })}
            loading={loading}
          />
          <StatTile
            tone="green"
            label={t('dashboard.summary.paid.label')}
            value={formatCurrency(totals.paid)}
            hint={t('dashboard.summary.paid.hint', {
              time: formatDurationFromMinutes(
                Math.round(totals.minutesPaid),
                t,
              ),
            })}
            loading={loading}
          />
          <StatTile
            tone="amber"
            label={t('dashboard.summary.unpaid.label')}
            value={formatCurrency(totals.unpaid)}
            hint={t('dashboard.summary.unpaid.hint', {
              time: formatDurationFromMinutes(
                Math.round(totals.minutesUnpaid),
                t,
              ),
            })}
            loading={loading}
          />
        </>
      )}
    </StatStrip>
  )
}
