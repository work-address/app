import { combine, createStore } from 'effector'

import {
  changeProjectStateFilter,
  setProjectsStateFiltering,
} from './projects.events'
import { projectsQuery, projectsStatsQuery } from './projects.queries'
import { mapProjectsAndStats } from './utils'

import type { ProjectWithStats, ProjectsFilter } from './types'
import type { baseApi } from '@/shared'

export const $projectStateFilter = createStore<ProjectsFilter>({
  projectState: 'All',
  containsText: '',
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

export const $filteredProjects = combine(
  $projects,
  $projectStateFilter,
  (projects, filter): ProjectWithStats[] => {
    let filteredProjects = [...projects]

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
