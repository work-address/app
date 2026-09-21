import { combine, createStore } from 'effector'

import { focusedProject, narrowToFocusedProject } from './focused-project'
import {
  changeProjectStateFilter,
  setProjectsStateFiltering,
} from './projects.events'
import {
  projectProcessStatsQuery,
  projectsProcessStatsQuery,
  projectsQuery,
  projectsStatsQuery,
} from './projects.queries'
import { mapProjectsAndStats } from './utils'

import type {
  ProjectWithStats,
  ProjectsFilter,
  ProjectProcessStats,
} from './types'
import type { baseApi } from '@/shared'

export const $projectStateFilter = createStore<ProjectsFilter>({
  projectState: 'All',
  containsText: '',
  focusedProjectId: null,
}).on(changeProjectStateFilter, (state, filter) => ({
  ...state,
  ...filter,
}))

export const $projectsLoading = combine(
  projectsQuery.$pending,
  projectsStatsQuery.$pending,
  (...flags) => flags.some((flag) => flag),
)

export const $rawProjects = projectsQuery.$data.map(
  (projects) =>
    projects?.items.reduce(
      (acc, project) => {
        if (project.id) {
          acc[project.id] = project
        }

        return acc
      },
      {} as Record<string, baseApi.Project>,
    ) ?? {},
)

export const $projects = combine(
  projectsQuery.$data,
  projectsStatsQuery.$data,
  $projectStateFilter,
  (projects, stats): ProjectWithStats[] =>
    mapProjectsAndStats(projects?.items, stats ?? undefined),
)

/**
 * What to do about a `/?project=<id>` link: show the whole dashboard, narrow
 * it to that project, or say it cannot be opened. Judged against the
 * projects this account can actually see, and never while they are still
 * loading - see `focusedProject`.
 */
export const $focusedProject = combine(
  $projectStateFilter,
  $projects,
  $projectsLoading,
  (filter, projects, loading) =>
    focusedProject({
      param: filter.focusedProjectId,
      visibleProjectIds: loading
        ? null
        : projects
            .map((project) => project.id)
            .filter((id): id is string => Boolean(id)),
    }),
)

export const $filteredProjects = combine(
  $projects,
  $projectStateFilter,
  $focusedProject,
  (projects, filter, focused): ProjectWithStats[] => {
    let filteredProjects = narrowToFocusedProject([...projects], focused)

    if (filter.projectState !== 'All') {
      filteredProjects = filteredProjects.filter(
        (project) => project.state === filter.projectState,
      )
    }

    if (filter.containsText) {
      filteredProjects = filteredProjects.filter(
        (project) =>
          project.title
            .toLowerCase()
            .includes(filter.containsText.trim().toLowerCase()) ||
          project.text
            ?.toLowerCase()
            .includes(filter.containsText.trim().toLowerCase()),
      )
    }

    return filteredProjects
  },
)

export const $isProjectsFiltering = createStore(false)
  .on(setProjectsStateFiltering, (_, payload) => payload)
  .on($filteredProjects, () => false)

export const $hasProjects = $projects.map((projects) => projects.length > 0)

export const $projectsWithProcessTracking = $projects.map((projects) =>
  projects.filter((project) => Boolean(project.trackProcesses)),
)

export const $projectsProcessStats = projectsProcessStatsQuery.$data.map(
  (stats): ProjectProcessStats[] => stats ?? [],
)

export const $projectsProcessStatsLoading = projectsProcessStatsQuery.$pending

export const $projectProcessStats = projectProcessStatsQuery.$data

export const $projectProcessStatsLoading = projectProcessStatsQuery.$pending
