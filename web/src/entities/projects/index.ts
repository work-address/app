import { sample } from 'effector'
import i18n from 'i18next'

import { fetchProjects, fetchProjectsProcessStats } from './projects.events'
import {
  createProjectMutation,
  deleteProjectMutation,
  editProjectMutation,
} from './projects.mutations'
import {
  projectsProcessStatsQuery,
  projectsQuery,
  projectsStatsQuery,
} from './projects.queries'
import { $projectsWithProcessTracking } from './projects.stores'

import { showToast } from '@/shared'

sample({
  clock: fetchProjects,
  target: projectsQuery.start,
})

sample({
  clock: projectsQuery.finished.success,
  fn: ({ result }) =>
    result.items
      .map((project) => project.id)
      .filter((id): id is string => Boolean(id)),
  target: projectsStatsQuery.start,
})

sample({
  clock: fetchProjectsProcessStats,
  source: $projectsWithProcessTracking,
  fn: (projects, period) => ({
    projectIds: projects
      .map((project) => project.id)
      .filter((id): id is string => Boolean(id)),
    period,
  }),
  target: projectsProcessStatsQuery.start,
})

const showProcessStatsError = () => {
  showToast('error', {
    message: i18n.t('dashboard.applicationsUsage.loadError'),
    position: 'top-center',
  })
}

projectsProcessStatsQuery.finished.failure.watch(showProcessStatsError)

projectsProcessStatsQuery.finished.success.watch(({ result }) => {
  if (result.some((stats) => stats.failed)) {
    showProcessStatsError()
  }
})

sample({
  clock: [
    createProjectMutation.finished.success.map(() => void 0),
    deleteProjectMutation.finished.success.map(() => void 0),
    editProjectMutation.finished.success.map(() => void 0),
  ],
  target: projectsQuery.start,
})

export {
  type ProjectWithStats,
  type ProjectsFilter,
  type StatsPeriod,
  type ProjectProcessStats,
} from './types'

export { OTHER_PROCESS_NAME } from './utils'

export {
  fetchProjects,
  fetchProjectsProcessStats,
  changeProjectStateFilter,
  setProjectsStateFiltering,
} from './projects.events'

export {
  createProjectMutation,
  deleteProjectMutation,
  editProjectMutation,
} from './projects.mutations'

export {
  $projects,
  $projectsLoading,
  $hasProjects,
  $filteredProjects,
  $projectStateFilter,
  $isProjectsFiltering,
  $rawProjects,
  $projectsWithProcessTracking,
  $hasProjectsWithProcessTracking,
  $projectsProcessStats,
  $projectsProcessStatsLoading,
} from './projects.stores'
