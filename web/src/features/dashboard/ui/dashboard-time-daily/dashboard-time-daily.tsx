import { useUnit } from 'effector-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import {
  $dashboardRange,
  dashboardStatisticsRequested,
} from '../../model/dashboard-filters'
import {
  bucketKeyOf,
  bucketLabels,
  periodBuckets,
} from '../../model/period-buckets'
import { projectSeries } from '../../model/project-series'
import { DashboardWidget } from '../dashboard-widget'

import { $projects } from '@/entities/projects'
import { statisticsDailyQuery } from '@/entities/statistics'
import {
  BucketBarChart,
  formatDurationFromMinutes,
  weekStartsOnFor,
  type Bucket,
} from '@/shared'

/** Tracked time across the period, one bar per day, week or month. */
export const DashboardTimeDaily = () => {
  const { t, i18n } = useTranslation()

  const { range, allProjects, rows, pending, failed, retry } = useUnit({
    range: $dashboardRange,
    allProjects: $projects,
    rows: statisticsDailyQuery.$data,
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

    const buckets: Bucket[] = periods.map((period) => ({
      key: period.key,
      ...bucketLabels(period, i18n.language),
      values: values.get(period.key) ?? {},
    }))

    return { buckets, series }
  }, [allProjects, range, rows, i18n.language, t])

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
        buckets={chart.buckets}
        series={chart.series}
        formatValue={formatHours}
        formatTick={(hours) =>
          t('dashboard.charts.hoursTick', { value: hours })
        }
        totalLabel={t('dashboard.charts.total')}
        emptyLabel={t('dashboard.timeDaily.tooltipEmpty')}
      />
    </DashboardWidget>
  )
}
