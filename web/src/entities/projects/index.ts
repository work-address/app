import { sample } from 'effector'

import { fetchProjects } from './projects.events'
import {
  createProjectMutation,
  deleteProjectMutation,
  editProjectMutation,
} from './projects.mutations'
import { projectsQuery, projectsStatsQuery } from './projects.queries'

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
  clock: [
    createProjectMutation.finished.success.map(() => void 0),
    deleteProjectMutation.finished.success.map(() => void 0),
    editProjectMutation.finished.success.map(() => void 0),
  ],
  target: projectsQuery.start,
})

export { type ProjectWithStats, type ProjectsFilter } from './types'

export {
  fetchProjects,
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
} from './projects.stores'
