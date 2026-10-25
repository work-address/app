import { useUnit } from 'effector-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import {
  $dashboardProjects,
  dashboardStatisticsRequested,
} from '../../model/dashboard-filters'

import { $hasProjects, $projectsLoading } from '@/entities/projects'
import {
  statisticsAgentsQuery,
  statisticsOverviewQuery,
  statisticsPreviousOverviewQuery,
  type StatisticsTotalsRow,
} from '@/entities/statistics'
import {
  formatCurrency,
  formatDurationFromMinutes,
  LoadFailure,
  StatStrip,
  StatTile,
} from '@/shared'

type Totals = {
  minutes: number
  minutesActive: number
  earned: number
  unpaid: number
  minutesUnpaid: number
  /** False when every row is a project the reader only views. */
  hasDetail: boolean
}

/**
 * Sums the period's rows. A project the reader only views comes without its
 * detail; the activity and money figures leave it out rather than count it
 * as zero. Money is each project's tracked time at its own rate, so a cheap
 * project's backlog is never valued at an expensive one's.
 */
const sumTotals = (
  rows: StatisticsTotalsRow[] | null,
  rates: Map<string | undefined, number>,
): Totals => {
  const acc: Totals = {
    minutes: 0,
    minutesActive: 0,
    earned: 0,
    unpaid: 0,
    minutesUnpaid: 0,
    hasDetail: false,
  }

  for (const row of rows ?? []) {
    acc.minutes += row.trackedSeconds / 60

    if (row.paidSeconds === undefined) {
      continue
    }

    const rate = rates.get(row.projectId) ?? 0
    const unpaid = Math.max(0, row.trackedSeconds - row.paidSeconds) / 60

    acc.hasDetail = true
    acc.minutesActive += (row.activeSeconds ?? 0) / 60
    acc.earned += (row.trackedSeconds / 3600) * rate
    acc.unpaid += (unpaid * rate) / 60
    acc.minutesUnpaid += unpaid
  }

  return acc
}

/**
 * The headline figures for the period: how much was worked, how much of it
 * was active, what it is worth, what is still unpaid, and what agents did.
 * Each compares with the same stretch of the period before.
 */
export const DashboardSummary = () => {
  const { t } = useTranslation()

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

  const rates = useMemo(
    () =>
      new Map(
        projects.map((project) => [project.id, Number(project.rateHour) || 0]),
      ),
    [projects],
  )
  const totals = useMemo(() => sumTotals(rows, rates), [rows, rates])
  const previous = useMemo(
    () => (previousRows ? sumTotals(previousRows, rates) : null),
    [previousRows, rates],
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

  return (
    <StatStrip $columns={showDetail ? 5 : 1}>
      <StatTile
        label={t('dashboard.summary.tracked.label')}
        value={duration(totals.minutes)}
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
          <StatTile
            tone="accent"
            label={t('dashboard.summary.active.label')}
            value={`${Math.round(activeShare(totals) * 100)}%`}
            hint={[
              t('dashboard.summary.active.hint', {
                time: duration(totals.minutesActive),
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
          <StatTile
            tone="green"
            label={t('dashboard.summary.earned.label')}
            value={formatCurrency(totals.earned)}
            hint={
              change(totals.earned, previous?.earned) ??
              t('dashboard.summary.earned.hint')
            }
            loading={loading}
          />
          <StatTile
            tone="amber"
            label={t('dashboard.summary.unpaid.label')}
            value={formatCurrency(totals.unpaid)}
            hint={t('dashboard.summary.unpaid.hint', {
              time: duration(totals.minutesUnpaid),
            })}
            loading={loading}
          />
          <StatTile
            label={t('dashboard.summary.agents.label')}
            // Assisted and autonomous are two figures, never one sum: the
            // first is the value, the second its line, so the tile is as
            // tall as its neighbours.
            value={
              hasAgents ? (
                <AgentValue>
                  {duration(agentTotals.assisted)}
                  <small>{t('dashboard.summary.agents.assisted')}</small>
                </AgentValue>
              ) : (
                '—'
              )
            }
            hint={
              hasAgents
                ? t('dashboard.summary.agents.autonomousHint', {
                    time: duration(agentTotals.autonomous),
                  })
                : t('dashboard.summary.agents.none')
            }
            loading={loading}
          />
        </>
      )}
    </StatStrip>
  )
}

const AgentValue = styled.span`
  display: inline-grid;
  grid-auto-flow: column;
  align-items: baseline;
  gap: 4px;
  white-space: nowrap;

  small {
    color: var(--ds-neutral-11);
    font-size: var(--font-size-1);
    font-weight: 400;
  }
`
