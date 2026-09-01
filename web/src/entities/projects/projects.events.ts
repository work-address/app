import { createEvent } from 'effector'
import { debounce } from 'patronum/debounce'

import { type ProjectsFilter, type StatsPeriod } from './types'

export const fetchProjects = createEvent()

export const fetchProjectsProcessStats = createEvent<StatsPeriod>()

export const fetchProjectProcessStats = createEvent<{
  projectId: string
  period: StatsPeriod
}>()

export const changeProjectStateFilter = createEvent<Partial<ProjectsFilter>>()

const PROJECT_STATE_FILTER_DEBOUNCE = 2000

export const debouncedChangeProjectStateFilter = debounce(
  changeProjectStateFilter,
  PROJECT_STATE_FILTER_DEBOUNCE,
)

export const setProjectsStateFiltering = createEvent<boolean>()
