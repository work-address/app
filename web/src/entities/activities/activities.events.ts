import { createEvent } from 'effector'

import { type WorklogsFilters, type ActivityStateFilter } from './types'

import type { WorklogSort } from './types'

export const fetchActivities = createEvent()

export const fetchInvoice = createEvent<{ id: string }>()

export const fetchWorklogs = createEvent()

export const changeActivityStateFilter = createEvent<ActivityStateFilter>()

export const setWorklogsLoading = createEvent<boolean>()

export const changeWorklogFilters = createEvent<Partial<WorklogsFilters>>()

export const applyWorklogFilters = createEvent()

export const appendWorklogSort = createEvent<WorklogSort>()

export const resetWorklogSort = createEvent<WorklogSort | null>()
