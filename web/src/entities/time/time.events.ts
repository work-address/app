import { createEvent } from 'effector'
import { debounce } from 'patronum/debounce'

import type { TimeFilters, TimeSort } from './types'

export const fetchTime = createEvent()

export const setTimeLoading = createEvent<boolean>()

export const changeTimeFilters = createEvent<Partial<TimeFilters>>()

const DESKTOP_CHANGE_TIME_FILTERS_DEBOUNCE_TIME = 1500

export const debouncedChangeTimeFilters = debounce(
  changeTimeFilters,
  DESKTOP_CHANGE_TIME_FILTERS_DEBOUNCE_TIME,
)

export const applyTimeFilters = createEvent()

export const resetTimeFilters = createEvent()

export const appendTimeSort = createEvent<TimeSort>()

export const resetTimeSort = createEvent<TimeSort | null>()

export const loadMoreTime = createEvent()
