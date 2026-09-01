import { useUnit } from 'effector-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { $hasProjects, $projects, $projectsLoading } from '@/entities/projects'
import {
  formatCurrency,
  formatDurationFromMinutes,
  StatStrip,
  StatTile,
} from '@/shared'

/**
 * The four numbers a freelancer opens the dashboard for: how much they have
 * worked, how much of that was real activity, what has been paid for and what
 * has not. Summed over every project, whatever tab or search is applied
 * below - the strip is the whole picture, the table is the detail.
 */
export const DashboardSummary = () => {
  const { t } = useTranslation()

  const { projects, loading, hasProjects } = useUnit({
    projects: $projects,
    loading: $projectsLoading,
    hasProjects: $hasProjects,
  })

  const totals = useMemo(
    () =>
      projects.reduce(
        (acc, project) => ({
          minutes: acc.minutes + (project.minutes || 0),
          minutesActive: acc.minutesActive + (project.minutesActive || 0),
          minutesPaid: acc.minutesPaid + (project.minutesPaid || 0),
          minutesUnpaid: acc.minutesUnpaid + (project.minutesUnpaid || 0),
          paid: acc.paid + (project.paid || 0),
          // Priced at each project's own rate, so a cheap project's backlog
          // does not get valued at an expensive one's rate.
          unpaid:
            acc.unpaid +
            ((project.minutesUnpaid || 0) * (project.rateHour || 0)) / 60,
        }),
        {
          minutes: 0,
          minutesActive: 0,
          minutesPaid: 0,
          minutesUnpaid: 0,
          paid: 0,
          unpaid: 0,
        },
      ),
    [projects],
  )

  // Nothing to sum until there is a project; the empty state below the title
  // already says so.
  if (!loading && !hasProjects) {
    return null
  }

  const activePercent =
    totals.minutes > 0
      ? Math.round((totals.minutesActive / totals.minutes) * 100)
      : 0

  return (
    <StatStrip>
      <StatTile
        label={t('dashboard.summary.tracked.label')}
        value={formatDurationFromMinutes(totals.minutes, t)}
        hint={t('dashboard.summary.tracked.hint', {
          projects: t('dashboard.page.projectsCount', {
            count: projects.length,
          }),
        })}
        loading={loading}
      />
      <StatTile
        tone="accent"
        label={t('dashboard.summary.active.label')}
        value={formatDurationFromMinutes(totals.minutesActive, t)}
        hint={t('dashboard.summary.active.hint', { percent: activePercent })}
        loading={loading}
      />
      <StatTile
        tone="green"
        label={t('dashboard.summary.paid.label')}
        value={formatCurrency(totals.paid)}
        hint={t('dashboard.summary.paid.hint', {
          time: formatDurationFromMinutes(totals.minutesPaid, t),
        })}
        loading={loading}
      />
      <StatTile
        tone="amber"
        label={t('dashboard.summary.unpaid.label')}
        value={formatCurrency(totals.unpaid)}
        hint={t('dashboard.summary.unpaid.hint', {
          time: formatDurationFromMinutes(totals.minutesUnpaid, t),
        })}
        loading={loading}
      />
    </StatStrip>
  )
}
