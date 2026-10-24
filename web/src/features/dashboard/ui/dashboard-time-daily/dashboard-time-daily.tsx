import { useUnit } from 'effector-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import {
  $dashboardProjects,
  $dashboardRange,
  dashboardStatisticsRequested,
} from '../../model/dashboard-filters'
import {
  bucketKeyOf,
  bucketLabels,
  periodBuckets,
} from '../../model/period-buckets'
import {
  projectSeries,
  projectSeriesKey,
  projectSlots,
} from '../../model/project-series'
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

  const { range, allProjects, projects, rows, pending, failed, retry } =
    useUnit({
      range: $dashboardRange,
      allProjects: $projects,
      projects: $dashboardProjects,
      rows: statisticsDailyQuery.$data,
      pending: statisticsDailyQuery.$pending,
      failed: statisticsDailyQuery.$failed,
      retry: dashboardStatisticsRequested,
    })

  const chart = useMemo(() => {
    const weekStartsOn = weekStartsOnFor(i18n.language)
    const slots = projectSlots(allProjects)
    const periods = periodBuckets(range, weekStartsOn)
    const size = periods[0]?.size ?? 'day'
    const values = new Map<string, Record<string, number>>()
    const withTime = new Set<string>()

    for (const row of rows ?? []) {
      const key = bucketKeyOf(row.day, size, weekStartsOn)
      const series = projectSeriesKey(slots, row.projectId)
      const bucket = values.get(key) ?? {}

      bucket[series] = (bucket[series] ?? 0) + row.trackedSeconds / 3600
      values.set(key, bucket)
      withTime.add(row.projectId)
    }

    const buckets: Bucket[] = periods.map((period) => ({
      key: period.key,
      ...bucketLabels(period, i18n.language),
      values: values.get(period.key) ?? {},
    }))

    return {
      buckets,
      series: projectSeries(
        projects,
        slots,
        withTime,
        t('dashboard.charts.other'),
      ),
    }
  }, [allProjects, projects, range, rows, i18n.language, t])

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
