import { createEvent } from 'effector'
import { debounce } from 'patronum/debounce'

import { type WorklogsFilters } from './types'

import type { WorklogSort } from './types'

export const fetchWorklogs = createEvent()

export const setWorklogsLoading = createEvent<boolean>()

export const changeWorklogFilters = createEvent<Partial<WorklogsFilters>>()

const DESKTOP_CHANGE_WORKLOG_FILTERS_DEBOUNCE_TIME = 1500

export const debouncedChangeWorklogFilters = debounce(
  changeWorklogFilters,
  DESKTOP_CHANGE_WORKLOG_FILTERS_DEBOUNCE_TIME,
)

export const applyWorklogFilters = createEvent()

export const resetWorklogFilters = createEvent()

export const appendWorklogSort = createEvent<WorklogSort>()

export const resetWorklogSort = createEvent<WorklogSort | null>()

export const loadMoreWorklogs = createEvent()
