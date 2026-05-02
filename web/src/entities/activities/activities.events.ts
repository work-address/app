import { createEvent } from 'effector'
import { debounce } from 'patronum/debounce'

import { type WorklogsFilters, type ProjectsFilter } from './types'

import type { WorklogSort } from './types'

export const fetchActivities = createEvent()

export const fetchInvoice = createEvent<{ id: string }>()

export const resetInvoice = createEvent()

export const fetchWorklogs = createEvent()

export const changeActivityStateFilter = createEvent<Partial<ProjectsFilter>>()

const ACTIVITY_STATE_FILTER_DEBOUNCE = 2000

export const debouncedChangeActivityStateFilter = debounce(
  changeActivityStateFilter,
  ACTIVITY_STATE_FILTER_DEBOUNCE,
)

export const setWorklogsLoading = createEvent<boolean>()

export const changeWorklogFilters = createEvent<Partial<WorklogsFilters>>()

const DESKTOP_CHANGE_WORKLOG_FILTERS_DEBOUNCE_TIME = 1500

export const debouncedChangeWorklogFilters = debounce(
  changeWorklogFilters,
  DESKTOP_CHANGE_WORKLOG_FILTERS_DEBOUNCE_TIME,
)

export const applyWorklogFilters = createEvent()

export const appendWorklogSort = createEvent<WorklogSort>()

export const resetWorklogSort = createEvent<WorklogSort | null>()

export const setActivitiesStateFiltering = createEvent<boolean>()
