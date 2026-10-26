import { useUnit } from 'effector-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { bucketBreakdowns } from '../../model/bucket-breakdown'
import {
  $dashboardRange,
  dashboardStatisticsRequested,
} from '../../model/dashboard-filters'
import {
  bucketKeyOf,
  bucketLabels,
  periodBuckets,
  visibleBuckets,
} from '../../model/period-buckets'
import { projectSeries } from '../../model/project-series'
import { DashboardWidget } from '../dashboard-widget'

import { $projects } from '@/entities/projects'
import {
  statisticsAgentsQuery,
  statisticsDailyQuery,
} from '@/entities/statistics'
import {
  BucketBarChart,
  formatDurationFromMinutes,
  weekStartsOnFor,
  type Bucket,
  type ChartTooltipContent,
} from '@/shared'

/** How many projects or agents a popup column names before it sums the rest. */
const POPUP_ROWS = 6

/** Tracked time across the period, one bar per day, week or month. */
export const DashboardTimeDaily = () => {
  const { t, i18n } = useTranslation()

  const { range, allProjects, rows, agents, pending, failed, retry } = useUnit({
    range: $dashboardRange,
    allProjects: $projects,
    rows: statisticsDailyQuery.$data,
    agents: statisticsAgentsQuery.$data,
    pending: statisticsDailyQuery.$pending,
    failed: statisticsDailyQuery.$failed,
    retry: dashboardStatisticsRequested,
  })

  const chart = useMemo(() => {
    const weekStartsOn = weekStartsOnFor(i18n.language)
    const periods = periodBuckets(range, weekStartsOn)
    const size = periods[0]?.size ?? 'day'
    const totals = new Map<string, number>()

    for (const row of rows ?? []) {
      totals.set(
        row.projectId,
        (totals.get(row.projectId) ?? 0) + row.trackedSeconds,
      )
    }

    const { keyOf, series } = projectSeries(
      allProjects,
      totals,
      t('dashboard.charts.other'),
    )
    const values = new Map<string, Record<string, number>>()

    for (const row of rows ?? []) {
      const key = bucketKeyOf(row.day, size, weekStartsOn)
      const seriesKey = keyOf(row.projectId)
      const bucket = values.get(key) ?? {}

      bucket[seriesKey] = (bucket[seriesKey] ?? 0) + row.trackedSeconds / 3600
      values.set(key, bucket)
    }

    const buckets: Bucket[] = visibleBuckets(
      periods,
      new Set(values.keys()),
    ).map((period) => ({
      key: period.key,
      ...bucketLabels(period, i18n.language),
      values: values.get(period.key) ?? {},
    }))

    return {
      buckets,
      series,
      keyOf,
      breakdowns: bucketBreakdowns(
        rows ?? [],
        agents?.daily ?? [],
        size,
        weekStartsOn,
      ),
      periodMinutes: [...totals.values()].reduce((sum, s) => sum + s, 0) / 60,
    }
  }, [allProjects, agents, range, rows, i18n.language, t])

  const titles = useMemo(
    () => new Map(allProjects.map((project) => [project.id, project.title])),
    [allProjects],
  )

  const duration = (minutes: number) =>
    formatDurationFromMinutes(Math.round(minutes), t)

  /** Everything about a bar: its total and share, then what filled it. */
  const describe = (key: string): ChartTooltipContent => {
    const bar = chart.breakdowns.get(key)

    if (!bar || bar.peopleMinutes === 0) {
      return { rows: [], note: t('dashboard.timeDaily.tooltipEmpty') }
    }

    const colors = new Map(chart.series.map((s) => [s.key, s.color]))
    const share =
      chart.periodMinutes > 0 ? bar.peopleMinutes / chart.periodMinutes : 0
    const agentMinutes = bar.agents.assisted + bar.agents.autonomous
    const more = (count: number) =>
      count > POPUP_ROWS
        ? [
            {
              label: t('dashboard.charts.more', { count: count - POPUP_ROWS }),
              value: '',
            },
          ]
        : []

    return {
      rows: [
        {
          label: t('dashboard.charts.popup.tracked'),
          value: duration(bar.peopleMinutes),
        },
        {
          label: t('dashboard.charts.popup.share'),
          value: `${Math.max(share > 0 ? 1 : 0, Math.round(share * 100))}%`,
        },
        {
          label: t('dashboard.charts.popup.projects'),
          value: String(bar.projects.length),
        },
        ...(agentMinutes > 0
          ? [
              {
                label: t('dashboard.agents.assisted'),
                value: duration(bar.agents.assisted),
              },
              {
                label: t('dashboard.agents.autonomous'),
                value: duration(bar.agents.autonomous),
              },
            ]
          : []),
      ],
      sections: [
        {
          title: t('dashboard.insights.cell.projects'),
          rows: [
            ...bar.projects.slice(0, POPUP_ROWS).map((project) => ({
              label:
                titles.get(project.projectId) ?? t('dashboard.charts.other'),
              value: duration(project.minutes),
              color: colors.get(chart.keyOf(project.projectId)),
            })),
            ...more(bar.projects.length),
          ],
        },
        {
          title: t('dashboard.agents.title'),
          rows: bar.products.slice(0, POPUP_ROWS).map((product) => ({
            label: product.product,
            value: duration(product.assisted + product.autonomous),
          })),
        },
      ],
    }
  }

  const formatHours = (hours: number) =>
    formatDurationFromMinutes(Math.round(hours * 60), t)

  return (
    <DashboardWidget
      title={t('dashboard.timeDaily.title')}
      loading={pending && rows === null}
      failed={failed}
      onRetry={retry}
      empty={
        chart.series.length === 0
          ? {
              title: t('dashboard.timeDaily.empty.title'),
              description: t('dashboard.timeDaily.empty.description'),
            }
          : undefined
      }
    >
      <BucketBarChart
        fill
        buckets={chart.buckets}
        series={chart.series}
        formatValue={formatHours}
        formatTick={(hours) =>
          t('dashboard.charts.hoursTick', { value: hours })
        }
        totalLabel={t('dashboard.charts.total')}
        emptyLabel={t('dashboard.timeDaily.tooltipEmpty')}
        describe={describe}
      />
    </DashboardWidget>
  )
}
