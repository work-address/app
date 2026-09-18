import { attach, combine, createEvent, createStore, sample } from 'effector'

import { hasInvoicedTime } from './time-invoiced'

import {
  $allTime,
  deleteTimeMutation,
  setTimePaidStatusMutation,
  type Time,
} from '@/entities/time'
import { confirmFx, showToastFx, translate } from '@/shared'

/**
 * Session state for the worklogs table and its dialog. It lives here rather
 * than in useState because it is read by siblings (the mobile bulk bar, the
 * dialog, the navigation model) and because the reactions to it - clearing a
 * selection once a delete lands, closing a dialog whose row was removed - are
 * consequences of domain events, not of rendering.
 */

export const timeSelectionChanged = createEvent<Record<string, boolean>>()
export const timeSelectionCleared = createEvent()
export const timeRowClicked = createEvent<Time>()
export const timeEntryFocused = createEvent<string>()
export const timeDialogOpenChanged = createEvent<boolean>()
export const timeDialogClosed = createEvent()
export const timeFiltersOpenChanged = createEvent<boolean>()
export const timeBulkDeleteRequested = createEvent<string[]>()
export const timeBulkPaidStatusRequested = createEvent<boolean>()

export const $timeSelection = createStore<Record<string, boolean>>({})
  .on(timeSelectionChanged, (_, selection) => selection)
  .reset(timeSelectionCleared)

export const $selectedTimeIds = $timeSelection.map((selection) =>
  Object.keys(selection).filter((id) => selection[id]),
)

export const $selectedTimeCount = $selectedTimeIds.map((ids) => ids.length)

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

/**
 * Whether the selection includes an entry an invoice bills. Its payment is
 * the invoice's to change, and the API refuses the whole paid/unpaid request
 * if any entry has one, so the bulk actions are withheld instead.
 */
export const $selectionHasInvoicedTime = combine(
  $allTime,
  $selectedTimeIds,
  hasInvoicedTime,
)

export const $isTimeBulkPending = combine(
  setTimePaidStatusMutation.$pending,
  deleteTimeMutation.$pending,
  (isSettingPaidStatus, isDeleting) => isSettingPaidStatus || isDeleting,
)

// --- Bulk paid status -------------------------------------------------------

sample({
  clock: timeBulkPaidStatusRequested,
  source: {
    ids: $selectedTimeIds,
    isPending: $isTimeBulkPending,
    hasInvoiced: $selectionHasInvoicedTime,
  },
  filter: ({ ids, isPending, hasInvoiced }) =>
    !isPending && !hasInvoiced && ids.length > 0,
  fn: ({ ids }, isPaid) => ({ ids, isPaid }),
  target: setTimePaidStatusMutation.start,
})

sample({
  clock: setTimePaidStatusMutation.finished.success,
  target: [timeSelectionCleared, setTimePaidStatusMutation.reset],
})

sample({
  clock: setTimePaidStatusMutation.finished.success,
  fn: () => ({
    type: 'success' as const,
    messageKey: 'dashboard.worklogsTable.paymentStatus.changed',
  }),
  target: showToastFx,
})

// --- Bulk delete ------------------------------------------------------------

/**
 * Attached so `.done` belongs to this flow alone - confirmFx is shared by
 * every confirm in the app, and its own `.done` fires for all of them.
 */
const confirmBulkDeleteFx = attach({ effect: confirmFx })

/**
 * Held across the confirm round-trip: the dialog resolves with its own props,
 * not with what the user was acting on.
 */
const $pendingDeleteIds = createStore<string[]>([])
  .on(timeBulkDeleteRequested, (_, ids) => ids)
  .reset(deleteTimeMutation.finished.finally, confirmBulkDeleteFx.fail)

sample({
  clock: timeBulkDeleteRequested,
  source: $isTimeBulkPending,
  filter: (isPending, ids) => !isPending && ids.length > 0,
  fn: (_, ids) => ({
    title: translate('dashboard.worklogsTable.bulk.confirmDelete.title'),
    description: translate(
      'dashboard.worklogsTable.bulk.confirmDelete.description',
      { count: ids.length },
    ),
    confirmLabel: translate(
      'dashboard.worklogsTable.bulk.confirmDelete.confirm',
    ),
    cancelLabel: translate('common.cancel'),
  }),
  target: confirmBulkDeleteFx,
})

sample({
  clock: confirmBulkDeleteFx.done,
  source: $pendingDeleteIds,
  filter: (ids) => ids.length > 0,
  target: deleteTimeMutation.start,
})

sample({
  clock: deleteTimeMutation.finished.success,
  target: [timeSelectionCleared, deleteTimeMutation.reset],
})

// Close the dialog only when the row it was showing is one of the deleted.
sample({
  clock: deleteTimeMutation.finished.success,
  source: $selectedTimeId,
  filter: (selectedId, { params }) =>
    Boolean(selectedId && params.includes(selectedId)),
  target: timeDialogClosed,
})

sample({
  clock: deleteTimeMutation.finished.success,
  fn: () => ({
    type: 'success' as const,
    messageKey: 'dashboard.worklogsTable.bulk.deletedMessage',
  }),
  target: showToastFx,
})
