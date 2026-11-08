import { useUnit } from 'effector-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import {
  $dashboardInsightsDays,
  $dashboardInsightsWidened,
  dashboardStatisticsRequested,
} from '../../model/dashboard-filters'
import { weekHourDetail } from '../../model/week-hour-detail'
import { DashboardWidget } from '../dashboard-widget'

import { $projects } from '@/entities/projects'
import {
  statisticsHourlyQuery,
  statisticsInsightsQuery,
} from '@/entities/statistics'
import {
  formatCount,
  formatCompactDurationFromMinutes,
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
type Props = {
  /** A full-width row: the heatmap and the figures side by side. */
  wide?: boolean
}

export const DashboardInsights = ({ wide = false }: Props) => {
  const { t, i18n } = useTranslation()

  const { hourly, insights, widened, days, projects, pending, failed, retry } =
    useUnit({
      widened: $dashboardInsightsWidened,
      days: $dashboardInsightsDays,
      projects: $projects,
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

  const cells = useMemo(
    () =>
      (hourly ?? []).map((row) => ({
        weekday: row.weekday,
        hour: row.hour,
        value: row.activeSeconds / 60,
      })),
    [hourly],
  )

  const rowsByKey = useMemo(
    () =>
      new Map((hourly ?? []).map((row) => [`${row.weekday}:${row.hour}`, row])),
    [hourly],
  )

  const projectTitles = useMemo(
    () => new Map(projects.map((project) => [project.id, project.title])),
    [projects],
  )

  const duration = (minutes: number) =>
    formatDurationFromMinutes(Math.round(minutes), t)
  const focusValue = (compact: boolean) =>
    insights && insights.focus.count > 0
      ? t('dashboard.insights.focusValue', {
          count: insights.focus.count,
          time: compact
            ? formatCompactDurationFromMinutes(
                insights.focus.minutes,
                i18n.language,
              )
            : duration(insights.focus.minutes),
          longest: compact
            ? formatCompactDurationFromMinutes(
                insights.focus.longestMinutes,
                i18n.language,
              )
            : duration(insights.focus.longestMinutes),
        })
      : t('dashboard.insights.focusNone')

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
      <Root data-wide={wide || undefined}>
        <Section>
          <Caption>
            {t('dashboard.insights.heatmap')}
            {/* A day or a week has no pattern to show: the figures reach back
                four weeks, and say so. */}
            {widened ? ` · ${t('dashboard.insights.lastFourWeeks')}` : ''}
          </Caption>
          <HeatmapScroll
            tabIndex={0}
            aria-label={t('dashboard.insights.heatmap')}
          >
            <Chart>
              <WeekHourHeatmap
                cells={cells}
                weekdays={weekdays}
                formatHour={formatHour}
                formatValue={(minutes) =>
                  t('dashboard.insights.activeCell', {
                    time: duration(minutes),
                  })
                }
                describe={(cell) => {
                  const title = `${
                    weekdays.find((day) => day.weekday === cell.weekday)
                      ?.title ?? ''
                  }, ${formatHour(cell.hour)} – ${formatHour((cell.hour + 1) % 24)}`
                  const row = rowsByKey.get(`${cell.weekday}:${cell.hour}`)
                  const detail = weekHourDetail(row, hourly ?? [], days)

                  // An hour with no time has nothing to break down.
                  if (!row || detail.trackedMinutes === 0) {
                    return {
                      title,
                      rows: [],
                      note: t('dashboard.insights.cell.none'),
                    }
                  }

                  const percent = (share: number) => {
                    const value = Math.round(share * 100)

                    return value < 1 ? '<1%' : `${value}%`
                  }

                  return {
                    title,
                    rows: [
                      {
                        label: t('dashboard.insights.cell.active'),
                        value:
                          detail.activeShare === null
                            ? duration(detail.activeMinutes)
                            : `${duration(detail.activeMinutes)} · ${percent(detail.activeShare)}`,
                      },
                      {
                        label: t('dashboard.insights.cell.tracked'),
                        value: duration(detail.trackedMinutes),
                      },
                      {
                        label: t('dashboard.insights.cell.days'),
                        value: t('dashboard.insights.cell.daysValue', {
                          days: detail.days,
                          weeks: detail.weeks,
                        }),
                      },
                      {
                        label: t('dashboard.insights.cell.weekly'),
                        value: duration(detail.weeklyMinutes),
                      },
                      {
                        label: t('dashboard.insights.cell.share'),
                        value: percent(detail.share),
                      },
                      ...(detail.rank === null
                        ? []
                        : [
                            {
                              label: t('dashboard.insights.cell.rank'),
                              value: t('dashboard.insights.cell.rankValue', {
                                rank: detail.rank,
                                count: detail.rankedHours,
                              }),
                            },
                          ]),
                      ...(detail.keysPerActiveHour === null
                        ? []
                        : [
                            {
                              label: t('dashboard.insights.cell.keys'),
                              value: formatCount(detail.keysPerActiveHour),
                            },
                            {
                              label: t('dashboard.insights.cell.clicks'),
                              value: formatCount(
                                detail.clicksPerActiveHour ?? 0,
                              ),
                            },
                          ]),
                    ],
                    sections: [
                      {
                        title: t('dashboard.insights.cell.projects'),
                        rows: row.projects.map((project) => ({
                          label:
                            projectTitles.get(project.projectId) ??
                            t('dashboard.charts.other'),
                          value: duration(project.seconds / 60),
                        })),
                      },
                      {
                        title: t('dashboard.insights.cell.apps'),
                        rows: row.apps.map((app) => ({
                          label: app.name,
                          value: duration(app.seconds / 60),
                        })),
                      },
                    ],
                    note: detail.busiest
                      ? t('dashboard.insights.cell.busiest')
                      : undefined,
                  }
                }}
              />
            </Chart>
          </HeatmapScroll>
        </Section>
        {insights ? (
          <Figures>
            <Figure>
              <dt>{t('dashboard.insights.productiveHours')}</dt>
              <dd>
                {insights.productiveHours.length > 0
                  ? insights.productiveHours
                      .map((hour) => formatHour(hour).replaceAll(' ', '\u00a0'))
                      .join(' · ')
                  : '—'}
              </dd>
            </Figure>
            <Figure>
              <dt>{t('dashboard.insights.focus')}</dt>
              <dd aria-label={focusValue(false)}>{focusValue(true)}</dd>
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
      </Root>
    </DashboardWidget>
  )
}

const Root = styled.div`
  display: grid;
  min-width: 0;
  gap: var(--ui-space-4);

  ${(p) => p.theme.breakpoints.up('xl')} {
    &[data-wide] {
      grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
      align-items: start;
      gap: var(--ui-section-gap);
    }
  }
`

const Section = styled.div`
  min-width: 0;
`

const Caption = styled.div`
  margin-bottom: var(--ui-space-3);
  color: var(--ui-muted);
  font-size: var(--ui-meta-size);
  line-height: var(--ui-meta-line-height);
`

const HeatmapScroll = styled.div`
  overflow-x: auto;
  padding: var(--ui-space-1);
  border-radius: var(--ui-space-2);

  &:focus-visible {
    outline: var(--ui-focus-width) solid var(--ui-blue);
    outline-offset: calc(-1 * var(--ui-focus-offset));
  }
`

const Chart = styled.div`
  min-width: var(--ui-chart-heatmap-min-width);
`

const Figures = styled.dl`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--ui-space-3);
  margin: 0;

  ${(p) => p.theme.breakpoints.down('md')} {
    grid-template-columns: minmax(0, 1fr);
  }
`

const Figure = styled.div`
  display: grid;
  align-content: start;
  gap: var(--ui-space-2);
  min-width: 0;
  padding: var(--ui-space-3);
  border-radius: var(--ui-space-3);
  background: var(--ui-inset);

  dt {
    color: var(--ui-muted);
    font-size: var(--ui-meta-size);
    line-height: var(--ui-meta-line-height);
  }

  dd {
    margin: 0;
    color: var(--ui-text);
    font-size: var(--ui-body-size);
    line-height: var(--ui-body-line-height);
    font-weight: var(--ui-weight-medium);
    font-variant-numeric: tabular-nums;
    overflow-wrap: anywhere;
  }
`
