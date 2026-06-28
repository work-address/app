import { combine, createStore, restore } from 'effector'

import {
  changeWorklogFilters,
  appendWorklogSort,
  resetWorklogSort,
  setWorklogsLoading,
} from './time.events'
import { worklogsQuery } from './time.queries'

import type { WorklogsFilters, WorklogSort } from './types'

export const $worklogsFilters = createStore<WorklogsFilters>({
  page: 0,
  fromAt: null,
  toAt: null,
  activityId: null,
  note: null,
  timeActiveMin: null,
  timeActiveMax: null,
  keyboardKeysMin: null,
  keyboardKeysMax: null,
  mouseKeysMin: null,
  mouseKeysMax: null,
  mouseDistanceMin: null,
  mouseDistanceMax: null,
}).on(changeWorklogFilters, (state, filters) => ({ ...state, ...filters }))

export const $worklogSort = createStore<WorklogSort>({ fromAt: 'DESC' })
  .on(appendWorklogSort, (state, sort) => ({ ...state, ...sort }))
  .on(resetWorklogSort, (_, payload) => payload ?? { fromAt: 'DESC' })

export const $allWorklogs = combine(
  worklogsQuery.$data,
  (time) => time?.items ?? [],
)

export const $isWorklogsFiltering = createStore(false)
  .on([$worklogsFilters, $worklogSort], () => true)
  .on(worklogsQuery.finished.finally, () => false)

export const $worklogsLoading = restore(setWorklogsLoading, false).on(
  worklogsQuery.$pending,
  (_, payload) => payload,
)
