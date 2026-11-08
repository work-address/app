import { ArrowRightIcon, ClockIcon } from '@radix-ui/react-icons'
import { Skeleton } from '@radix-ui/themes'
import { useStoreMap, useUnit } from 'effector-react'
import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import {
  $timeWeekDays,
  $timeWeekFailed,
  $timeWeekPending,
  $timeWeekSummary,
  getTimeSelectedDay,
  getTimeWeek,
  getTimeWeekAnchor,
  timeWeekDaySelected,
  timeWeekRequested,
  timeWeekWholeSelected,
} from '../../model'

import { $timeFilters } from '@/entities/time'
import {
  formatCompactDurationFromMinutes,
  formatCurrency,
  formatDurationFromMinutes,
  fromDay,
  LoadFailure,
  useDateFormatter,
  weekStartsOnFor,
  WorkspaceMetric,
  WorkspacePanel,
  WorkspaceSummary,
} from '@/shared'

const ICON_SIZE = 14

/**
 * The week around the date filter: its totals, then each day, from the
 * server's statistics rather than the pages of entries loaded so far. A day
 * narrows the list below to that day; the whole week widens it again.
 */
export const TimeWeek = () => {
  const { t, i18n } = useTranslation()
  const language = i18n.resolvedLanguage ?? i18n.language
  const dateFormatter = useDateFormatter()

  const range = useStoreMap({
    store: $timeFilters,
    keys: [],
    fn: ({ fromAt, toAt, activityId }) => ({ fromAt, toAt, activityId }),
  })

  const { summary, days, pending, failed, request, selectDay, selectWeek } =
    useUnit({
      summary: $timeWeekSummary,
      days: $timeWeekDays,
      pending: $timeWeekPending,
      failed: $timeWeekFailed,
      request: timeWeekRequested,
      selectDay: timeWeekDaySelected,
      selectWeek: timeWeekWholeSelected,
    })

  const week = useMemo(
    () =>
      getTimeWeek(
        getTimeWeekAnchor(range, new Date()),
        weekStartsOnFor(language),
      ),
    [range, language],
  )
  const selectedDay = getTimeSelectedDay(range)
  const projectId = range.activityId

  useEffect(() => {
    request({ week, projectId })
    // The week is identified by its first day; a new object for the same
    // week must not ask again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [week.from, projectId, request])

  const weekdayFormatter = useMemo(
    () => new Intl.DateTimeFormat(language, { weekday: 'short' }),
    [language],
  )
  const longWeekdayFormatter = useMemo(
    () => new Intl.DateTimeFormat(language, { weekday: 'long' }),
    [language],
  )
  const dayNumberFormatter = useMemo(
    () => new Intl.DateTimeFormat(language, { day: 'numeric' }),
    [language],
  )

  const compact = (seconds: number) =>
    formatCompactDurationFromMinutes(seconds / 60, language)
  const full = (seconds: number) =>
    formatDurationFromMinutes(Math.round(seconds / 60), t)

  const loading = pending && !summary
  const retry = () => request({ week, projectId })

  const weekSeconds = (days ?? []).reduce(
    (total, day) => total + day.trackedSeconds,
    0,
  )
  const selected = days?.find((day) => day.day === selectedDay)
  const showActive = summary?.activeSeconds !== undefined || loading
  const showEarned = summary?.earnedCents !== undefined || loading
  // A viewer sees tracked time alone; the strip holds as many as there are.
  const metricCount = 1 + Number(showActive) + Number(showEarned)

  if (failed) {
    return (
      <LoadFailure
        size="panel"
        title={t('time.week.loadFailure')}
        onRetry={retry}
      />
    )
  }

  return (
    <>
      <WorkspaceSummary
        detail={metricCount > 1}
        columns={metricCount === 3 ? 3 : metricCount === 2 ? 2 : undefined}
      >
        <WorkspaceMetric
          label={t('dashboard.summary.tracked.label')}
          value={compact(summary?.trackedSeconds ?? 0)}
          valueLabel={full(summary?.trackedSeconds ?? 0)}
          hint={t('dashboard.summary.tracked.hint', {
            projects: t('dashboard.page.projectsCount', {
              count: summary?.projectCount ?? 0,
            }),
          })}
          loading={loading}
        />
        {showActive ? (
          <WorkspaceMetric
            label={t('dashboard.summary.active.label')}
            value={`${
              summary && summary.trackedSeconds > 0
                ? Math.round(
                    ((summary.activeSeconds ?? 0) / summary.trackedSeconds) *
                      100,
                  )
                : 0
            }%`}
            hint={t('dashboard.summary.active.hint', {
              time: compact(summary?.activeSeconds ?? 0),
            })}
            loading={loading}
          />
        ) : null}
        {showEarned ? (
          <WorkspaceMetric
            label={t('dashboard.summary.earned.label')}
            value={formatCurrency((summary?.earnedCents ?? 0) / 100)}
            hint={t('dashboard.summary.earned.hint')}
            loading={loading}
          />
        ) : null}
      </WorkspaceSummary>
      <WorkspacePanel
        title={t('time.week.title')}
        description={dateFormatter.formatRange(
          fromDay(week.from),
          fromDay(week.to),
        )}
        aside={
          days ? (
            <Total>
              {t('time.week.weekTotal', { time: compact(weekSeconds) })}
            </Total>
          ) : null
        }
      >
        <Body>
          <Days>
            {week.days.map((day) => {
              const date = fromDay(day)
              const seconds =
                days?.find((entry) => entry.day === day)?.trackedSeconds ?? 0

              return (
                <Day
                  key={day}
                  type="button"
                  aria-pressed={day === selectedDay}
                  aria-label={t('time.week.selectDay', {
                    day: dateFormatter.format(date),
                  })}
                  disabled={!days}
                  onClick={() => selectDay(day)}
                >
                  <Weekday>{weekdayFormatter.format(date)}</Weekday>
                  <DayNumber>{dayNumberFormatter.format(date)}</DayNumber>
                  {days ? (
                    <DayTotal>{compact(seconds)}</DayTotal>
                  ) : (
                    <Skeleton width="32px" height="16px" />
                  )}
                </Day>
              )
            })}
          </Days>
          {selectedDay ? (
            <Footer>
              <Caption>
                <ClockIcon width={ICON_SIZE} height={ICON_SIZE} aria-hidden />
                {t('time.week.dayTotal', {
                  time: compact(selected?.trackedSeconds ?? 0),
                  day: longWeekdayFormatter.format(fromDay(selectedDay)),
                })}
              </Caption>
              <WholeWeek type="button" onClick={() => selectWeek()}>
                {t('time.week.showWeek')}
                <ArrowRightIcon
                  width={ICON_SIZE}
                  height={ICON_SIZE}
                  aria-hidden
                />
              </WholeWeek>
            </Footer>
          ) : null}
        </Body>
      </WorkspacePanel>
    </>
  )
}

const Total = styled.span`
  padding: var(--ui-space-2) var(--ui-space-3);
  border-radius: var(--ui-pill-radius);
  background: var(--ui-glow);
  color: var(--ui-blue);
  font-size: var(--ui-meta-size);
  line-height: var(--ui-meta-line-height);
  font-weight: var(--ui-weight-medium);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
`

const Body = styled.div`
  display: grid;
  gap: var(--ui-space-4);
`

/* Seven across; a phone takes four, then three. */
const Days = styled.div`
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: var(--ui-space-2);

  ${(p) => p.theme.breakpoints.down('md')} {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
`

const Day = styled.button`
  display: grid;
  justify-items: center;
  gap: var(--ui-space-1);
  padding: var(--ui-space-3) var(--ui-space-1);
  border-radius: var(--ui-control-radius);
  background: var(--ui-inset);
  color: var(--ui-ink);
  cursor: pointer;
  transition:
    background var(--ui-transition),
    color var(--ui-transition);

  &:hover:not(:disabled):not([aria-pressed='true']) {
    background: var(--ui-glow);
  }

  &[aria-pressed='true'] {
    background: var(--ui-blue);
    color: var(--ui-surface);
    box-shadow: var(--ui-shadow);
  }

  &:disabled {
    cursor: default;
  }

  &:focus-visible {
    outline: var(--ui-focus-width) solid var(--ui-blue);
    outline-offset: var(--ui-focus-offset);
  }
`

const Weekday = styled.span`
  font-size: var(--ui-meta-size);
  line-height: var(--ui-meta-line-height);
  opacity: 0.8;
`

const DayNumber = styled.span`
  font-size: var(--ui-figure-size);
  line-height: var(--ui-figure-line-height);
  font-weight: var(--ui-weight-semibold);
  font-variant-numeric: tabular-nums;
`

const DayTotal = styled.span`
  font-size: var(--ui-meta-size);
  line-height: var(--ui-meta-line-height);
  font-variant-numeric: tabular-nums;
  opacity: 0.8;
  white-space: nowrap;
`

const Footer = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--ui-space-3);
`

const Caption = styled.span`
  display: inline-grid;
  grid-auto-flow: column;
  justify-content: start;
  align-items: center;
  gap: var(--ui-space-2);
  color: var(--ui-muted);
  font-size: var(--ui-meta-size);
  line-height: var(--ui-meta-line-height);
`

const WholeWeek = styled.button`
  display: inline-grid;
  grid-auto-flow: column;
  align-items: center;
  gap: var(--ui-space-1);
  border-radius: var(--ui-inline-radius);
  color: var(--ui-blue);
  font-size: var(--ui-meta-size);
  line-height: var(--ui-meta-line-height);
  font-weight: var(--ui-weight-medium);
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }

  &:focus-visible {
    outline: var(--ui-focus-width) solid var(--ui-blue);
    outline-offset: var(--ui-focus-offset);
  }
`
