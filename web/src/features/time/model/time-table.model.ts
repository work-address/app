import { combine, createEvent, createStore, sample } from 'effector'

import { $allTime, type Time } from '@/entities/time'

/**
 * Session state for the worklogs table and its dialog. It lives here rather
 * than in useState because it is read by siblings (the mobile bulk bar, the
 * dialog, the navigation model) and because the reactions to it - clearing a
 * selection once a delete lands, closing a dialog whose row was removed - are
 * consequences of domain events, not of rendering.
 */

export const timeRowClicked = createEvent<Time>()
export const timeEntryFocused = createEvent<string>()
export const timeDialogOpenChanged = createEvent<boolean>()
export const timeDialogClosed = createEvent()
export const timeFiltersOpenChanged = createEvent<boolean>()
export const $selectedTimeId = createStore<string | null>(null)
  .on(timeRowClicked, (_, row) => row.id ?? null)
  .on(timeEntryFocused, (_, id) => id)
  .reset(timeDialogClosed)

export const $isTimeDialogOpen = createStore(false)
  .on(timeRowClicked, () => true)
  .on(timeDialogOpenChanged, (_, open) => open)
  .reset(timeDialogClosed)

export const $timeFiltersOpen = createStore(false).on(
  timeFiltersOpenChanged,
  (_, open) => open,
)

// Dismissing the dialog by its own means must also drop the focused row, so
// there is a single way to express "closed" for everything downstream.
sample({
  clock: timeDialogOpenChanged,
  filter: (open) => !open,
  target: timeDialogClosed,
})

/**
 * The dialog reads its row out of the feed by id rather than holding a copy,
 * so an edit or a refetch is reflected without a synchronising effect.
 */
export const $selectedTimeEntry = combine(
  $allTime,
  $selectedTimeId,
  (rows, selectedId) => rows.find((row) => row.id === selectedId) ?? null,
)
