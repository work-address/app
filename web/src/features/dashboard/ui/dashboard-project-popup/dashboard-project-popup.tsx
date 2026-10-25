import { useUnit } from 'effector-react'
import { useCallback, useMemo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { $dashboardRange } from '../../model/dashboard-filters'
import {
  bucketKeyOf,
  bucketLabels,
  periodBuckets,
  visibleBuckets,
} from '../../model/period-buckets'
import {
  projectSummary,
  type ProjectWithAccess,
} from '../../model/project-summary'

import { $user } from '@/entities/profile'
import { $projects } from '@/entities/projects'
import {
  statisticsDailyQuery,
  statisticsOverviewQuery,
  statisticsProjectAppsQuery,
} from '@/entities/statistics'
import {
  ChartTooltip,
  BucketBarChart,
  SERIES_COLORS,
  formatCount,
  formatCurrency,
  formatDurationFromMinutes,
  weekStartsOnFor,
  type Bucket,
  type ChartTooltipContent,
  type ChartTooltipRow,
} from '@/shared'

/** How many workers or apps a column names before it sums the rest. */
const NAMED = 5

/**
 * Everything the dashboard knows about a project, as popup content: the
 * period's time and money, all-time totals, the team, the apps used and what
 * the project tracks. Activity and money stay out for a reader who only
 * views, as the API keeps them.
 */
export const useDashboardProjectPopup = () => {
  const { t, i18n } = useTranslation()

  const { projects, user, totals, apps, daily } = useUnit({
    projects: $projects,
    user: $user,
    totals: statisticsOverviewQuery.$data,
    apps: statisticsProjectAppsQuery.$data,
    daily: statisticsDailyQuery.$data,
  })

  const started = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.language, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
    [i18n.language],
  )

  return useCallback(
    (projectId: string): ChartTooltipContent | null => {
      const project = projects.find((p) => p.id === projectId)
      if (!project) {
        return null
      }

      const summary = projectSummary(
        project as ProjectWithAccess,
        user?.id,
        totals?.find((row) => row.projectId === projectId),
        apps ?? [],
        daily ?? [],
      )
      const duration = (minutes: number) =>
        formatDurationFromMinutes(Math.round(minutes), t)
      const onOff = (on: boolean) =>
        on ? t('dashboard.projectPopup.on') : t('dashboard.projectPopup.off')
      const more = (count: number): ChartTooltipRow[] =>
        count > NAMED
          ? [
              {
                label: t('dashboard.charts.more', { count: count - NAMED }),
                value: '',
              },
            ]
          : []
      const { period, allTime, team, tracking } = summary

      return {
        title: project.title,
        rows: [
          {
            label: t('dashboard.projectPopup.role'),
            value: t(`dashboard.projectPopup.roles.${summary.role}`),
          },
          {
            label: t('dashboard.projectPopup.status'),
            value: t(
              `dashboard.projectsTable.status.${summary.status.toLowerCase()}`,
              { defaultValue: summary.status },
            ),
          },
          {
            label: t('dashboard.projectPopup.rate'),
            value: formatCurrency(summary.rate),
          },
          {
            label: t('dashboard.charts.popup.tracked'),
            value: duration(period.trackedMinutes),
          },
          ...(period.activeMinutes === null
            ? []
            : [
                {
                  label: t('dashboard.insights.cell.active'),
                  value: duration(period.activeMinutes),
                },
                ...(period.activeShare === null
                  ? []
                  : [
                      {
                        label: t('dashboard.projectPopup.activeShare'),
                        value: `${Math.round(period.activeShare * 100)}%`,
                      },
                    ]),
                {
                  label: t('dashboard.summary.earned.label'),
                  value: formatCurrency(period.earned ?? 0),
                },
                {
                  label: t('dashboard.summary.unpaid.label'),
                  value: formatCurrency(period.unpaid ?? 0),
                },
              ]),
          {
            label: t('dashboard.projectPopup.days'),
            value: String(period.days),
          },
        ],
        sections: [
          {
            title: t('dashboard.projectPopup.allTime'),
            rows: [
              {
                label: t('dashboard.charts.popup.tracked'),
                value: duration(allTime.minutes),
              },
              {
                label: t('dashboard.insights.cell.active'),
                value: duration(allTime.minutesActive),
              },
              {
                label: t('dashboard.projectPopup.paid'),
                value: formatCurrency(allTime.paid),
              },
              {
                label: t('dashboard.projectPopup.paidTime'),
                value: duration(allTime.minutesPaid),
              },
              {
                label: t('dashboard.summary.unpaid.label'),
                value: duration(allTime.minutesUnpaid),
              },
              {
                label: t('dashboard.projectPopup.started'),
                value: project.createdAt
                  ? started.format(new Date(project.createdAt))
                  : '—',
              },
            ],
          },
          {
            title: t('dashboard.projectPopup.team'),
            // Names lead, so a long one ellipsises; the role is the value.
            rows: [
              ...(team.owner
                ? [
                    {
                      label: team.owner,
                      value: t('dashboard.projectPopup.owner'),
                    },
                  ]
                : []),
              ...team.workers.slice(0, NAMED).map((name) => ({
                label: name,
                value: t('dashboard.projectPopup.worker'),
              })),
              ...more(team.workers.length),
              ...(team.viewers > 0
                ? [
                    {
                      label: t('dashboard.projectPopup.viewers'),
                      value: String(team.viewers),
                    },
                  ]
                : []),
            ],
          },
          {
            title: t('dashboard.insights.cell.apps'),
            rows: [
              ...summary.apps.slice(0, NAMED).map((app) => ({
                label: app.name,
                value: duration(app.minutes),
              })),
              ...more(summary.apps.length),
            ],
          },
          {
            title: t('dashboard.projectPopup.activity'),
            rows: [
              {
                label: t('dashboard.projectsTable.head.keyboardKeys'),
                value: formatCount(allTime.keyboardKeys),
              },
              {
                label: t('dashboard.projectsTable.head.mouseKeys'),
                value: formatCount(allTime.mouseKeys),
              },
              {
                label: t('dashboard.projectsTable.head.mouseDistance'),
                value: formatCount(allTime.mouseDistance),
              },
            ],
          },
          {
            title: t('dashboard.projectPopup.tracking'),
            rows: [
              {
                label: t('dashboard.projectPopup.screenshots'),
                value: onOff(tracking.screenshots),
              },
              {
                label: t('dashboard.insights.cell.apps'),
                value: onOff(tracking.apps),
              },
              {
                label: t('dashboard.agents.title'),
                value: onOff(tracking.agents),
              },
              {
                label: t('dashboard.projectPopup.manual'),
                value: onOff(tracking.manual),
              },
              {
                label: t('dashboard.projectPopup.review'),
                value: t('dashboard.projectPopup.hours', {
                  count: tracking.reviewWindowHours,
                }),
              },
            ],
          },
        ],
      }
    },
    [projects, user, totals, apps, daily, t, started],
  )
}

type Props = {
  projectId: string
  /** `card` brings its own border and shadow; `plain` sits in a panel's. */
  variant?: 'card' | 'plain'
  /** Buttons under the details, such as invoicing the project. */
  actions?: ReactNode
}

/**
 * The project popup: its details in columns, its time over the period as a
 * small chart, and any actions the place it opens from offers.
 */
export const DashboardProjectPopup = ({
  projectId,
  variant = 'card',
  actions,
}: Props) => {
  const { t, i18n } = useTranslation()
  const describe = useDashboardProjectPopup()
  const { range, daily } = useUnit({
    range: $dashboardRange,
    daily: statisticsDailyQuery.$data,
  })
  const content = describe(projectId)

  const buckets = useMemo((): Bucket[] => {
    const weekStartsOn = weekStartsOnFor(i18n.language)
    const periods = periodBuckets(range, weekStartsOn)
    const size = periods[0]?.size ?? 'day'
    const hours = new Map<string, number>()

    for (const row of daily ?? []) {
      if (row.projectId !== projectId) {
        continue
      }

      const key = bucketKeyOf(row.day, size, weekStartsOn)

      hours.set(key, (hours.get(key) ?? 0) + row.trackedSeconds / 3600)
    }

    return visibleBuckets(periods, new Set(hours.keys())).map((period) => ({
      key: period.key,
      ...bucketLabels(period, i18n.language),
      values: { time: hours.get(period.key) ?? 0 },
    }))
  }, [daily, range, projectId, i18n.language])

  if (!content) {
    return null
  }

  return (
    <Root data-variant={variant}>
      <ChartTooltip
        title={content.title}
        rows={content.rows}
        sections={content.sections}
        layout="horizontal"
        variant="plain"
      />
      <Chart>
        <Caption>{t('dashboard.projectPopup.chart')}</Caption>
        <BucketBarChart
          height={110}
          buckets={buckets}
          series={[
            {
              key: 'time',
              label: t('dashboard.charts.popup.tracked'),
              color: SERIES_COLORS[0],
            },
          ]}
          formatValue={(hours) =>
            formatDurationFromMinutes(Math.round(hours * 60), t)
          }
          formatTick={(hours) =>
            t('dashboard.charts.hoursTick', { value: hours })
          }
          emptyLabel={t('dashboard.timeDaily.tooltipEmpty')}
        />
      </Chart>
      {actions ? <Actions>{actions}</Actions> : null}
    </Root>
  )
}

const Root = styled.div`
  display: grid;
  gap: var(--space-3);

  &[data-variant='card'] {
    padding: 10px 12px;
    border: 1px solid var(--ds-neutral-alpha-6);
    border-radius: 10px;
    background: var(--color-panel-solid);
    box-shadow: 0 1px 6px var(--c-rgba-0-0-0-0_08);
  }
`

const Chart = styled.div`
  display: grid;
  gap: var(--space-1);
  padding-top: var(--space-2);
  border-top: 1px solid var(--ds-neutral-alpha-5);
`

const Caption = styled.span`
  color: var(--ds-neutral-11);
  font-size: var(--font-size-1);
  font-weight: 500;
`

const Actions = styled.div`
  display: grid;
  grid-auto-flow: column;
  justify-content: end;
  gap: var(--space-2);
`
