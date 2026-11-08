import { useUnit } from 'effector-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import {
  $dashboardProjects,
  dashboardStatisticsRequested,
} from '../../model/dashboard-filters'

import {
  $hasProjects,
  $projectsLoading,
  type ProjectRole,
} from '@/entities/projects'
import {
  statisticsAgentsQuery,
  statisticsOverviewQuery,
  statisticsPreviousOverviewQuery,
  type StatisticsTotalsRow,
} from '@/entities/statistics'
import {
  formatCurrency,
  formatDurationFromMinutes,
  formatCompactDurationFromMinutes,
  LoadFailure,
  WorkspaceSummary,
  WorkspaceMetric,
} from '@/shared'

type Totals = {
  minutes: number
  minutesActive: number
  earnedCents: number
  unpaidCents: number
  minutesUnpaid: number
  /** False when every row is a project the reader only views. */
  hasDetail: boolean
}

/**
 * Sums the period's rows, which the API has priced. A project the reader only
 * views comes without its detail; the activity and money figures leave it out
 * rather than count it as zero.
 */
const sumTotals = (
  rows: StatisticsTotalsRow[] | null,
  roles: Map<string | undefined, ProjectRole>,
): Totals => {
  const acc: Totals = {
    minutes: 0,
    minutesActive: 0,
    earnedCents: 0,
    unpaidCents: 0,
    minutesUnpaid: 0,
    hasDetail: false,
  }

  for (const row of rows ?? []) {
    acc.minutes += row.trackedSeconds / 60

    if (roles.get(row.projectId) === 'viewer') {
      continue
    }

    acc.hasDetail = true
    acc.minutesActive += (row.activeSeconds ?? 0) / 60
    acc.earnedCents += row.earnedCents ?? 0
    acc.unpaidCents += row.unpaidCents ?? 0
    acc.minutesUnpaid += (row.unpaidSeconds ?? 0) / 60
  }

  return acc
}

/**
 * The headline figures for the period: how much was worked, how much of it
 * was active, what it is worth, what is still unpaid, and what agents did.
 * Each compares with the same stretch of the period before.
 */
export const DashboardSummary = () => {
  const { t, i18n } = useTranslation()

  const {
    projects,
    rows,
    previousRows,
    agents,
    pending,
    failed,
    retry,
    projectsLoading,
    hasProjects,
  } = useUnit({
    projects: $dashboardProjects,
    rows: statisticsOverviewQuery.$data,
    previousRows: statisticsPreviousOverviewQuery.$data,
    agents: statisticsAgentsQuery.$data,
    pending: statisticsOverviewQuery.$pending,
    failed: statisticsOverviewQuery.$failed,
    retry: dashboardStatisticsRequested,
    projectsLoading: $projectsLoading,
    hasProjects: $hasProjects,
  })

  const roles = useMemo(
    () => new Map(projects.map((project) => [project.id, project.role])),
    [projects],
  )
  const totals = useMemo(() => sumTotals(rows, roles), [rows, roles])
  const previous = useMemo(
    () => (previousRows ? sumTotals(previousRows, roles) : null),
    [previousRows, roles],
  )

  const agentTotals = useMemo(
    () =>
      (agents?.daily ?? []).reduce(
        (acc, row) => ({
          assisted: acc.assisted + row.assistedSeconds / 60,
          autonomous: acc.autonomous + row.autonomousSeconds / 60,
        }),
        { assisted: 0, autonomous: 0 },
      ),
    [agents],
  )

  // Nothing to sum until there is a project; the intro says so.
  if (!projectsLoading && !hasProjects) {
    return null
  }

  if (failed) {
    return (
      <LoadFailure
        size="panel"
        title={t('dashboard.summary.failure.title')}
        onRetry={retry}
      />
    )
  }

  // Refetching for a new period keeps the old figures until the new ones land.
  const loading = projectsLoading || (pending && rows === null)
  const showDetail = loading || totals.hasDetail || (rows ?? []).length === 0
  const hasAgents = (agents?.daily.length ?? 0) > 0

  const activeShare = (value: Totals) =>
    value.minutes > 0 ? value.minutesActive / value.minutes : 0

  /** "↑ 12% vs previous period", or nothing to compare with. */
  const change = (current: number, before: number | undefined) => {
    if (before === undefined) {
      return
    }

    if (before <= 0) {
      return current > 0 ? t('dashboard.summary.delta.new') : undefined
    }

    const percent = Math.round(((current - before) / before) * 100)

    if (percent === 0) {
      return t('dashboard.summary.delta.same')
    }

    return t('dashboard.summary.delta.change', {
      arrow: percent > 0 ? '↑' : '↓',
      percent: Math.abs(percent),
    })
  }

  /**
   * Percentage points, for a share that is already a percentage. Short, since
   * it shares its line with the active time.
   */
  const pointsChange = (current: number, before: number | undefined) => {
    if (before === undefined) {
      return
    }

    const points = Math.round((current - before) * 100)

    return points === 0
      ? undefined
      : t('dashboard.summary.delta.pointsShort', {
          arrow: points > 0 ? '↑' : '↓',
          points: Math.abs(points),
        })
  }

  const duration = (minutes: number) =>
    formatDurationFromMinutes(Math.round(minutes), t)
  const compactDuration = (minutes: number) =>
    formatCompactDurationFromMinutes(
      minutes,
      i18n.resolvedLanguage ?? i18n.language,
    )

  return (
    <WorkspaceSummary detail={showDetail}>
      <WorkspaceMetric
        label={t('dashboard.summary.tracked.label')}
        value={compactDuration(totals.minutes)}
        valueLabel={duration(totals.minutes)}
        hint={
          change(totals.minutes, previous?.minutes) ??
          t('dashboard.summary.tracked.hint', {
            projects: t('dashboard.page.projectsCount', {
              count: projects.length,
            }),
          })
        }
        loading={loading}
      />
      {showDetail && (
        <>
          <WorkspaceMetric
            label={t('dashboard.summary.active.label')}
            value={`${Math.round(activeShare(totals) * 100)}%`}
            hint={[
              t('dashboard.summary.active.hint', {
                time: compactDuration(totals.minutesActive),
              }),
              // A share of nothing is not a baseline.
              pointsChange(
                activeShare(totals),
                previous && previous.minutes > 0
                  ? activeShare(previous)
                  : undefined,
              ),
            ]
              .filter(Boolean)
              .join(' · ')}
            loading={loading}
          />
          <WorkspaceMetric
            label={t('dashboard.summary.earned.label')}
            value={formatCurrency(totals.earnedCents / 100)}
            hint={
              change(totals.earnedCents, previous?.earnedCents) ??
              t('dashboard.summary.earned.hint')
            }
            loading={loading}
          />
          <WorkspaceMetric
            label={t('dashboard.summary.unpaid.label')}
            value={formatCurrency(totals.unpaidCents / 100)}
            hint={t('dashboard.summary.unpaid.hint', {
              time: compactDuration(totals.minutesUnpaid),
            })}
            loading={loading}
          />
          <WorkspaceMetric
            label={t('dashboard.summary.agents.label')}
            // Assisted and autonomous are two figures, never one sum: the
            // first is the value, the second its line, so the tile is as
            // tall as its neighbours.
            value={
              hasAgents ? (
                <AgentValue>
                  {compactDuration(agentTotals.assisted)}
                  <small>{t('dashboard.summary.agents.assisted')}</small>
                </AgentValue>
              ) : (
                '—'
              )
            }
            valueLabel={
              hasAgents
                ? `${duration(agentTotals.assisted)} ${t('dashboard.summary.agents.assisted')}`
                : undefined
            }
            hint={
              hasAgents
                ? t('dashboard.summary.agents.autonomousHint', {
                    time: compactDuration(agentTotals.autonomous),
                  })
                : t('dashboard.summary.agents.none')
            }
            loading={loading}
          />
        </>
      )}
    </WorkspaceSummary>
  )
}

const AgentValue = styled.span`
  display: grid;
  gap: var(--ui-space-1);
  min-width: 0;

  small {
    color: var(--ui-muted);
    font-size: var(--ui-meta-size);
    font-weight: var(--ui-weight-regular);
    line-height: var(--ui-small-line-height);
    letter-spacing: 0;
  }
`
