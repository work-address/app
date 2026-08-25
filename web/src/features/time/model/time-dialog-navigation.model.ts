import { combine, createEvent, createStore, sample } from 'effector'

import { getTimeNavigationState, getTimeSiblingId } from './get-time-sibling-id'
import {
  $isTimeDialogOpen,
  $selectedTimeId,
  timeDialogClosed,
  timeEntryFocused,
} from './time-table.model'

import {
  $allTime,
  $hasMoreTime,
  $isLoadingMoreTime,
  loadMoreTime,
} from '@/entities/time'

/** Start fetching the next page once the open row is this close to the end. */
const PREFETCH_REMAINING_ITEMS = 2

export const timeDialogPrevRequested = createEvent()
export const timeDialogNextRequested = createEvent()

/**
 * Pressing "next" on the last loaded row cannot move anywhere yet. Rather than
 * tracking that intent in a ref and reconciling it from three effects, it is a
 * store: the move happens when a page arrives that contains a sibling, and is
 * abandoned when the feed reports there is nothing left to load.
 */
const nextPageAwaited = createEvent()
const nextPageAbandoned = createEvent()

const $awaitingNextPage = createStore(false)
  .on(nextPageAwaited, () => true)
  // Focusing any entry satisfies the pending intent.
  .reset(timeEntryFocused, timeDialogClosed, nextPageAbandoned)

const $navigation = combine({
  rows: $allTime,
  selectedId: $selectedTimeId,
  isOpen: $isTimeDialogOpen,
  hasMore: $hasMoreTime,
  isLoadingMore: $isLoadingMoreTime,
  awaiting: $awaitingNextPage,
})

export const $timeDialogNavigation = combine(
  $allTime,
  $selectedTimeId,
  $hasMoreTime,
  (rows, selectedId, hasMore) =>
    getTimeNavigationState(rows, selectedId, hasMore),
)

sample({
  clock: timeDialogPrevRequested,
  source: $navigation,
  filter: ({ rows, selectedId }) =>
    getTimeSiblingId(rows, selectedId, -1) !== null,
  fn: ({ rows, selectedId }) =>
    getTimeSiblingId(rows, selectedId, -1) as string,
  target: timeEntryFocused,
})

// The next row is already loaded - move straight to it.
sample({
  clock: timeDialogNextRequested,
  source: $navigation,
  filter: ({ rows, selectedId }) =>
    getTimeSiblingId(rows, selectedId, 1) !== null,
  fn: ({ rows, selectedId }) => getTimeSiblingId(rows, selectedId, 1) as string,
  target: timeEntryFocused,
})

// It is not loaded, but more pages exist - defer the move.
sample({
  clock: timeDialogNextRequested,
  source: $navigation,
  filter: ({ rows, selectedId, hasMore }) =>
    getTimeSiblingId(rows, selectedId, 1) === null && hasMore,
  target: nextPageAwaited,
})

sample({
  clock: nextPageAwaited,
  source: $navigation,
  filter: ({ isLoadingMore }) => !isLoadingMore,
  target: loadMoreTime,
})

// A page landed carrying the row that was being waited on.
sample({
  clock: $allTime,
  source: $navigation,
  filter: ({ awaiting, rows, selectedId }) =>
    awaiting && getTimeSiblingId(rows, selectedId, 1) !== null,
  fn: ({ rows, selectedId }) => getTimeSiblingId(rows, selectedId, 1) as string,
  target: timeEntryFocused,
})

// Loading settled and there is still no sibling - stop waiting.
sample({
  clock: [$allTime, $hasMoreTime, $isLoadingMoreTime],
  source: $navigation,
  filter: ({ awaiting, hasMore, isLoadingMore, rows, selectedId }) =>
    awaiting &&
    !isLoadingMore &&
    !hasMore &&
    getTimeSiblingId(rows, selectedId, 1) === null,
  target: nextPageAbandoned,
})

// Keep a page ahead of the reader while they walk the dialog.
sample({
  clock: [$selectedTimeId, $allTime],
  source: $navigation,
  filter: ({ isOpen, selectedId, hasMore, isLoadingMore, rows }) => {
    if (!isOpen || !selectedId || !hasMore || isLoadingMore) {
      return false
    }

    const currentIndex = rows.findIndex((row) => row.id === selectedId)

    if (currentIndex < 0) {
      return false
    }

    return rows.length - 1 - currentIndex <= PREFETCH_REMAINING_ITEMS
  },
  target: loadMoreTime,
})
