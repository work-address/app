import { useUnit } from 'effector-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { dashboardStatisticsRequested } from '../../model/dashboard-filters'
import { DashboardWidget } from '../dashboard-widget'

import {
  statisticsHourlyQuery,
  statisticsInsightsQuery,
} from '@/entities/statistics'
import {
  formatCount,
  formatDurationFromMinutes,
  weekStartsOnFor,
  WeekHourHeatmap,
} from '@/shared'

// A Monday, so ISO weekday n is this date plus n - 1 days.
const MONDAY = new Date(2026, 9, 19)

/**
 * When the reader works and how it goes - always about the reader, whoever
 * the people filter selects. There is no score: each figure stands alone.
 */
export const DashboardInsights = () => {
  const { t, i18n } = useTranslation()

  const { hourly, insights, pending, failed, retry } = useUnit({
    hourly: statisticsHourlyQuery.$data,
    insights: statisticsInsightsQuery.$data,
    pending: statisticsInsightsQuery.$pending,
    failed: statisticsInsightsQuery.$failed,
    retry: dashboardStatisticsRequested,
  })

  const weekdays = useMemo(() => {
    const first = weekStartsOnFor(i18n.language) || 7
    const short = new Intl.DateTimeFormat(i18n.language, { weekday: 'short' })
    const long = new Intl.DateTimeFormat(i18n.language, { weekday: 'long' })

    return Array.from({ length: 7 }, (_, index) => {
      const weekday = ((first - 1 + index) % 7) + 1
      const date = new Date(MONDAY)

      date.setDate(MONDAY.getDate() + weekday - 1)

      return { weekday, label: short.format(date), title: long.format(date) }
    })
  }, [i18n.language])

  const formatHour = useMemo(() => {
    const format = new Intl.DateTimeFormat(i18n.language, { hour: 'numeric' })

    return (hour: number) => format.format(new Date(2026, 0, 1, hour))
  }, [i18n.language])

  const duration = (minutes: number) =>
    formatDurationFromMinutes(Math.round(minutes), t)

  const nothingTracked =
    (hourly ?? []).length === 0 && (insights?.focus.count ?? 0) === 0

  return (
    <DashboardWidget
      title={t('dashboard.insights.title')}
      loading={pending && insights === null}
      failed={failed}
      onRetry={retry}
      empty={
        insights && nothingTracked
          ? {
              title: t('dashboard.insights.empty.title'),
              description: t('dashboard.insights.empty.description'),
            }
          : undefined
      }
    >
      <Layout>
        <div>
          <Caption>{t('dashboard.insights.heatmap')}</Caption>
          <WeekHourHeatmap
            cells={(hourly ?? []).map((row) => ({
              weekday: row.weekday,
              hour: row.hour,
              value: row.activeSeconds / 60,
            }))}
            weekdays={weekdays}
            formatHour={formatHour}
            formatValue={(minutes) =>
              t('dashboard.insights.activeCell', { time: duration(minutes) })
            }
          />
        </div>
        {insights ? (
          <Figures>
            <Figure>
              <dt>{t('dashboard.insights.productiveHours')}</dt>
              <dd>
                {insights.productiveHours.length > 0
                  ? insights.productiveHours.map(formatHour).join(' · ')
                  : '—'}
              </dd>
            </Figure>
            <Figure>
              <dt>{t('dashboard.insights.focus')}</dt>
              <dd>
                {insights.focus.count > 0
                  ? t('dashboard.insights.focusValue', {
                      count: insights.focus.count,
                      time: duration(insights.focus.minutes),
                      longest: duration(insights.focus.longestMinutes),
                    })
                  : t('dashboard.insights.focusNone')}
              </dd>
            </Figure>
            <Figure>
              <dt>{t('dashboard.insights.activeRatio')}</dt>
              <dd>
                {insights.activeRatio === null
                  ? '—'
                  : `${Math.round(insights.activeRatio * 100)}%`}
              </dd>
            </Figure>
            <Figure>
              <dt>{t('dashboard.insights.input')}</dt>
              <dd>
                {insights.keysPerActiveHour === null
                  ? '—'
                  : t('dashboard.insights.inputValue', {
                      keys: formatCount(insights.keysPerActiveHour),
                      clicks: formatCount(insights.clicksPerActiveHour ?? 0),
                    })}
              </dd>
            </Figure>
          </Figures>
        ) : null}
      </Layout>
    </DashboardWidget>
  )
}

const Layout = styled.div`
  display: grid;
  gap: var(--space-5);
`

const Caption = styled.div`
  margin-bottom: var(--space-2);
  color: var(--ds-neutral-11);
  font-size: var(--font-size-1);
`

const Figures = styled.dl`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3) var(--space-4);
  margin: 0;

  ${(p) => p.theme.breakpoints.down('md')} {
    grid-template-columns: minmax(0, 1fr);
  }
`

const Figure = styled.div`
  display: grid;
  gap: 2px;
  min-width: 0;

  dt {
    color: var(--ds-neutral-11);
    font-size: var(--font-size-1);
  }

  dd {
    margin: 0;
    color: var(--ds-neutral-12);
    font-size: var(--font-size-2);
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }
`
