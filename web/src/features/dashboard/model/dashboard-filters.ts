import { subDays } from 'date-fns'
import { combine, createEvent, createStore, merge, sample } from 'effector'
import i18n from 'i18next'

import { latestDesktopSession } from './desktop-session'
import { bucketSizeFor } from './period-buckets'

import { $user } from '@/entities/profile'
import { $projects, type ProjectWithStats } from '@/entities/projects'
import {
  statisticsAgentsQuery,
  statisticsDailyQuery,
  statisticsHourlyQuery,
  statisticsInsightsQuery,
  statisticsOverviewQuery,
  statisticsPreviousOverviewQuery,
  statisticsProjectAppsQuery,
  statisticsTeamQuery,
  type StatisticsQuery,
} from '@/entities/statistics'
import {
  recentAgentRunsQuery,
  recentScreenshotsQuery,
  recentTimeQuery,
  type RecentTimeParams,
} from '@/entities/time'
import {
  DEFAULT_DATE_RANGE_PRESET,
  fromDay,
  rangeLengthDays,
  toDay,
  parseDateRange,
  previousDateRange,
  resolveDateRange,
  toApiDateRange,
  weekStartsOnFor,
  type DateRange,
} from '@/shared'

export type DashboardFilters = {
  range: DateRange
  /** Empty: every project the reader can see. */
  projectIds: string[]
  /** Empty: everyone the reader can see. */
  userIds: string[]
}

export type DashboardPerson = { id: string; name: string }

const UUID = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i

const readIds = (value: string | null) =>
  [
    ...new Set(
      (value ?? '')
        .split(',')
        .map((id) => id.trim())
        .filter((id) => UUID.test(id)),
    ),
  ].slice(0, 100)

/** Filters from the dashboard's URL; anything unusable falls back to all. */
export const parseDashboardSearch = (
  search: URLSearchParams,
  now = new Date(),
): DashboardFilters => ({
  range: parseDateRange(
    search.get('from'),
    search.get('to'),
    now,
    weekStartsOnFor(i18n.language),
  ),
  projectIds: readIds(search.get('projects')),
  userIds: readIds(search.get('people')),
})

/** The same parameter names as /time, so a widget can link there. */
export const toDashboardSearch = (filters: DashboardFilters) => {
  const search = new URLSearchParams({
    from: filters.range.from,
    to: filters.range.to,
  })

  if (filters.projectIds.length > 0) {
    search.set('projects', filters.projectIds.join(','))
  }
  if (filters.userIds.length > 0) {
    search.set('people', filters.userIds.join(','))
  }

  return search
}

export const dashboardFiltersRestored = createEvent<DashboardFilters>()
export const dashboardRangeChanged = createEvent<DateRange>()
export const dashboardProjectsChanged = createEvent<string[]>()
export const dashboardPeopleChanged = createEvent<string[]>()
/** Reloads every period figure, for a retry. */
export const dashboardStatisticsRequested = createEvent()

export const $dashboardRange = createStore<DateRange>(
  resolveDateRange(
    DEFAULT_DATE_RANGE_PRESET,
    new Date(),
    weekStartsOnFor(i18n.language),
  ),
)
  .on(dashboardFiltersRestored, (_, { range }) => range)
  .on(dashboardRangeChanged, (_, range) => range)

export const $dashboardProjectIds = createStore<string[]>([])
  .on(dashboardFiltersRestored, (_, { projectIds }) => projectIds)
  .on(dashboardProjectsChanged, (_, ids) => ids)

export const $dashboardUserIds = createStore<string[]>([])
  .on(dashboardFiltersRestored, (_, { userIds }) => userIds)
  .on(dashboardPeopleChanged, (_, ids) => ids)

export const $dashboardFilters = combine({
  range: $dashboardRange,
  projectIds: $dashboardProjectIds,
  userIds: $dashboardUserIds,
})

const toStatisticsQuery = ({
  range,
  projectIds,
  userIds,
}: DashboardFilters): StatisticsQuery => ({
  ...toApiDateRange(range),
  // Days are the reader's days, wherever the server is.
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  ...(projectIds.length > 0 ? { projectIds } : {}),
  ...(userIds.length > 0 ? { userIds } : {}),
  // A day or two is drawn by the hour; anything longer by the day.
  ...(bucketSizeFor(range) === 'hour' ? { bucket: 'hour' as const } : {}),
})

export const $dashboardStatisticsQuery =
  $dashboardFilters.map(toStatisticsQuery)

/** The shortest stretch the reader's insights are drawn from. */
export const INSIGHTS_MIN_DAYS = 28

/**
 * Whether the insights reach back past the chosen period: a weekday-by-hour
 * pattern, focus and productive hours mean nothing over a day or two, so
 * they always look at the last four weeks at least.
 */
export const $dashboardInsightsWidened = $dashboardRange.map(
  (range) => rangeLengthDays(range) < INSIGHTS_MIN_DAYS,
)

/** How many days the insights are drawn from: the period, or four weeks. */
export const $dashboardInsightsDays = $dashboardRange.map((range) =>
  Math.max(INSIGHTS_MIN_DAYS, rangeLengthDays(range)),
)

export const $dashboardInsightsQuery = $dashboardFilters.map((filters) => {
  const { range } = filters
  const widened = rangeLengthDays(range) < INSIGHTS_MIN_DAYS
  const from = widened
    ? toDay(subDays(fromDay(range.to), INSIGHTS_MIN_DAYS - 1))
    : range.from

  return toStatisticsQuery({ ...filters, range: { ...range, from } })
})

/** The same filters over the period the KPI deltas compare with. */
export const $dashboardPreviousQuery = $dashboardFilters.map((filters) =>
  toStatisticsQuery({ ...filters, range: previousDateRange(filters.range) }),
)

/** The period as instants, for the searches that take them. */
export const $dashboardInstants = $dashboardRange.map(
  (range): RecentTimeParams => {
    const { to } = toApiDateRange(range)

    return {
      fromAt: fromDay(range.from).toISOString(),
      toAt: fromDay(to).toISOString(),
    }
  },
)

/** The projects the period figures cover: the selection, or all of them. */
export const $dashboardProjects = combine(
  $projects,
  $dashboardProjectIds,
  (projects, ids): ProjectWithStats[] => {
    if (ids.length === 0) {
      return projects
    }

    const selected = new Set(ids)

    return projects.filter((project) => selected.has(project.id ?? ''))
  },
)

/**
 * Everyone working on the reader's own projects. Empty for someone who owns
 * no project with workers, which hides the people filter: filtering by
 * person is an owner's tool, and the API refuses it to anyone else.
 */
export const $dashboardPeople = combine(
  $projects,
  $user,
  (projects, user): DashboardPerson[] => {
    if (!user?.id) {
      return []
    }

    const people = new Map<string, string>()

    for (const project of projects) {
      if (project.role !== 'owner') {
        continue
      }

      for (const worker of (project.workers ?? []) as {
        id?: string
        name?: string
        address?: string
      }[]) {
        if (worker.id && worker.id !== user.id) {
          people.set(worker.id, worker.name || worker.address || worker.id)
        }
      }
    }

    return [...people]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  },
)

/**
 * Whether the reader owns or works on any project. Someone who only views
 * never tracks, runs agents or takes screenshots, so the widgets about those
 * are left out rather than shown empty for good.
 */
export const $dashboardCanTrack = $projects.map((projects) =>
  projects.some(
    (project) => project.role === 'owner' || project.role === 'worker',
  ),
)

/** Whether the reader owns a project: the team list is theirs alone. */
export const $isDashboardOwner = $projects.map((projects) =>
  projects.some((project) => project.role === 'owner'),
)

const filtersApplied = merge([
  dashboardFiltersRestored,
  dashboardRangeChanged,
  dashboardProjectsChanged,
  dashboardPeopleChanged,
  dashboardStatisticsRequested,
])

sample({
  clock: filtersApplied,
  source: $dashboardStatisticsQuery,
  target: [
    statisticsOverviewQuery.start,
    statisticsProjectAppsQuery.start,
    statisticsDailyQuery.start,
    statisticsAgentsQuery.start,
  ],
})

sample({
  clock: filtersApplied,
  source: $dashboardInsightsQuery,
  target: [statisticsHourlyQuery.start, statisticsInsightsQuery.start],
})

sample({
  clock: filtersApplied,
  source: $dashboardPreviousQuery,
  target: statisticsPreviousOverviewQuery.start,
})

sample({
  clock: filtersApplied,
  source: $dashboardInstants,
  target: recentAgentRunsQuery.start,
})

sample({
  clock: filtersApplied,
  source: {
    instants: $dashboardInstants,
    projectIds: $dashboardProjectIds,
    userIds: $dashboardUserIds,
  },
  fn: ({ instants, projectIds, userIds }) => ({
    ...instants,
    projectIds,
    userIds,
  }),
  target: recentScreenshotsQuery.start,
})

// Ownership is only known once the projects arrive, which can be after the
// filters are restored.
sample({
  clock: [filtersApplied, $isDashboardOwner.updates],
  source: { query: $dashboardStatisticsQuery, owner: $isDashboardOwner },
  filter: ({ owner }) => owner,
  fn: ({ query }) => query,
  target: statisticsTeamQuery.start,
})

/** The newest screenshots matching the filter. */
export const $dashboardScreenshots = recentScreenshotsQuery.$data.map(
  (entries) => entries ?? [],
)

/** Asks again for the reader's latest session, after a failure. */
export const dashboardDesktopSessionRequested = createEvent()

/** Who the reader is, changing only when that does. */
const $readerId = $user.map((user) => user?.id ?? null)

// The reader's own entries: who they are can arrive after the filters.
sample({
  clock: [filtersApplied, $readerId.updates, dashboardDesktopSessionRequested],
  source: {
    instants: $dashboardInstants,
    projectIds: $dashboardProjectIds,
    user: $user,
  },
  filter: ({ user }) => Boolean(user?.id),
  fn: ({ instants, projectIds, user }) => ({
    ...instants,
    projectIds,
    userId: user?.id ?? '',
  }),
  target: recentTimeQuery.start,
})

/**
 * The signed-in person's latest desktop session in the period's projects:
 * always their own time, like their insights, whoever the people filter
 * selects.
 */
export const $dashboardDesktopSession = combine(
  recentTimeQuery.$data,
  $user,
  $dashboardProjects,
  (entries, user, projects) =>
    latestDesktopSession(entries ?? [], {
      userId: user?.id,
      projectIds: projects.map((project) => project.id ?? ''),
    }),
)
