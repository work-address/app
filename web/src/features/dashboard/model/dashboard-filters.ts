import { combine, createEvent, createStore, merge, sample } from 'effector'
import i18n from 'i18next'

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
  type RecentTimeParams,
} from '@/entities/time'
import {
  DEFAULT_DATE_RANGE_PRESET,
  fromDay,
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
})

export const $dashboardStatisticsQuery =
  $dashboardFilters.map(toStatisticsQuery)

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

type ProjectAccess = { user?: { id?: string }; workers?: unknown[] }

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

    for (const project of projects as (ProjectWithStats & ProjectAccess)[]) {
      if (project.user?.id !== user.id) {
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

/** Whether the reader owns a project: the team list is theirs alone. */
export const $isDashboardOwner = combine($projects, $user, (projects, user) =>
  Boolean(
    user?.id &&
      (projects as (ProjectWithStats & ProjectAccess)[]).some(
        (project) => project.user?.id === user.id,
      ),
  ),
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
    statisticsHourlyQuery.start,
    statisticsInsightsQuery.start,
    statisticsAgentsQuery.start,
  ],
})

sample({
  clock: filtersApplied,
  source: $dashboardPreviousQuery,
  target: statisticsPreviousOverviewQuery.start,
})

sample({
  clock: filtersApplied,
  source: $dashboardInstants,
  target: [recentAgentRunsQuery.start, recentScreenshotsQuery.start],
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

const VISIBLE_SCREENSHOTS = 8

/**
 * The newest screenshots matching the filter. The search takes one project at
 * most and no person, so the selection is applied to its newest page here.
 */
export const $dashboardScreenshots = combine(
  recentScreenshotsQuery.$data,
  $dashboardProjects,
  $dashboardUserIds,
  (entries, projects, userIds) => {
    const visible = new Set(projects.map((project) => project.id))
    const people = new Set(userIds)

    return (entries ?? [])
      .filter((entry) => visible.has(entry.project?.id))
      .filter(
        (entry) =>
          people.size === 0 ||
          people.has((entry as { user?: { id?: string } }).user?.id ?? ''),
      )
      .slice(0, VISIBLE_SCREENSHOTS)
  },
)
