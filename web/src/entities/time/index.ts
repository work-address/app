import { combine, sample } from 'effector'

import {
  fetchWorklogs,
  applyWorklogFilters,
  changeWorklogFilters,
  appendWorklogSort,
  resetWorklogSort,
  setWorklogsLoading,
  debouncedChangeWorklogFilters,
} from './time.events'
import { worklogsQuery, type WorklogsQueryParams } from './time.queries'
import { $worklogSort, $worklogsFilters } from './time.stores'

import { $breakpoints } from '@/shared'

sample({
  clock: [fetchWorklogs, applyWorklogFilters],
  source: combine($worklogsFilters, $worklogSort),
  fn: ([filters, sort]): WorklogsQueryParams => ({
    ...Object.fromEntries(
      Object.entries(filters).map(([key, value]) => [key, value ?? undefined]),
    ),
    sort,
  }),
  target: worklogsQuery.start,
})

sample({
  clock: [resetWorklogSort, appendWorklogSort],
  target: applyWorklogFilters,
})

sample({
  clock: debouncedChangeWorklogFilters,
  source: $breakpoints,
  filter: (breakpoints) => breakpoints.isDesktop,
  target: applyWorklogFilters,
})

sample({
  clock: changeWorklogFilters,
  source: $breakpoints,
  filter: (breakpoints) => breakpoints.isDesktop,
  target: setWorklogsLoading.prepend(() => true),
})

export {
  type ITimeTotal,
  type TimeTotalDetail as ITimeTotalDetail,
  type Time,
  type WorklogsFilters,
  type WorklogSort,
} from './types'

export {
  fetchWorklogs,
  changeWorklogFilters,
  appendWorklogSort as changeWorklogSort,
  applyWorklogFilters,
  resetWorklogSort,
} from './time.events'

export {
  $allWorklogs,
  $worklogsFilters,
  $worklogSort,
  $worklogsLoading,
  $isWorklogsFiltering,
} from './time.stores'
