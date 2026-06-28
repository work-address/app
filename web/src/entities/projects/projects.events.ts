import { createEvent } from 'effector'
import { debounce } from 'patronum/debounce'

import { type ProjectsFilter } from './types'

export const fetchProjects = createEvent()

export const changeProjectStateFilter = createEvent<Partial<ProjectsFilter>>()

const PROJECT_STATE_FILTER_DEBOUNCE = 2000

export const debouncedChangeProjectStateFilter = debounce(
  changeProjectStateFilter,
  PROJECT_STATE_FILTER_DEBOUNCE,
)

export const setProjectsStateFiltering = createEvent<boolean>()
