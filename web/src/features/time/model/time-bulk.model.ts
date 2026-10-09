import { attach, combine, createEvent, createStore, sample } from 'effector'

import {
  getSelectedTimeProjectId,
  isSameTimeSelection,
  type TimeBulkAction,
} from './time-bulk'
import {
  $selectedTimeIds,
  timeSelectionChangeAccepted,
  timeSelectionChanged,
  timeSelectionCleared,
} from './time-selection.model'
import { $selectedTimeId, timeDialogClosed } from './time-table.model'

import { invoiceSelectedTimeMutation } from '@/entities/invoice'
import {
  $allTime,
  deleteTimeMutation,
  editTimeMutation,
  removeTimeProcessesMutation,
  removeTimeScreenshotMutation,
  setTimePaidStatusMutation,
} from '@/entities/time'
import { confirmFx, showToastFx, translate } from '@/shared'

type BulkRequest = {
  action: TimeBulkAction
  ids: string[]
  projectId: string | null
}

export const timeBulkActionRequested = createEvent<TimeBulkAction>()
export const timeBulkSelectionClearRequested = createEvent()
// Existing public callers can keep their event names.
export const timeBulkDeleteRequested = createEvent<string[]>()
export const timeBulkPaidStatusRequested = createEvent<boolean>()
const bulkAccepted = createEvent<BulkRequest>()
const bulkOperationSucceeded = createEvent()

export const $selectedTimeProjectId = combine(
  $allTime,
  $selectedTimeIds,
  getSelectedTimeProjectId,
)

const confirmBulkFx = attach({
  effect: confirmFx,
  mapParams: ({ action, ids }: BulkRequest) => {
    const prefix =
      action === 'delete'
        ? 'dashboard.worklogsTable.bulk.confirmDelete'
        : action === 'remove-screenshots'
          ? 'dashboard.worklogsTable.bulk.confirmRemoveScreenshots'
          : 'dashboard.worklogsTable.bulk.confirmRemoveProcesses'
    return {
      title: translate(`${prefix}.title`),
      description: translate(`${prefix}.description`, { count: ids.length }),
      confirmLabel:
        action === 'delete'
          ? translate('dashboard.worklogsTable.bulk.confirmDelete.confirm')
          : translate('dashboard.worklogsTable.confirmRemoveProcesses.confirm'),
      cancelLabel: translate('common.cancel'),
    }
  },
})

const $mutationPending = combine(
  setTimePaidStatusMutation.$pending,
  deleteTimeMutation.$pending,
  removeTimeScreenshotMutation.$pending,
  removeTimeProcessesMutation.$pending,
  editTimeMutation.$pending,
  invoiceSelectedTimeMutation.$pending,
  (...pending) => pending.some(Boolean),
)
export const $isTimeBulkPending = combine(
  $mutationPending,
  confirmBulkFx.pending,
  (mutating, confirming) => mutating || confirming,
)

const $activeBulk = createStore<BulkRequest | null>(null)
  .on(bulkAccepted, (_, request) => request)
  .reset(
    bulkOperationSucceeded,
    setTimePaidStatusMutation.finished.failure,
    deleteTimeMutation.finished.failure,
    removeTimeScreenshotMutation.finished.failure,
    removeTimeProcessesMutation.finished.failure,
    invoiceSelectedTimeMutation.finished.failure,
    confirmBulkFx.fail,
  )

sample({
  clock: timeSelectionChanged,
  source: $isTimeBulkPending,
  filter: (pending) => !pending,
  fn: (_, selection) => selection,
  target: timeSelectionChangeAccepted,
})
sample({
  clock: timeBulkSelectionClearRequested,
  source: $isTimeBulkPending,
  filter: (pending) => !pending,
  target: timeSelectionCleared,
})
sample({
  clock: timeBulkPaidStatusRequested,
  fn: (paid) => (paid ? ('paid' as const) : ('unpaid' as const)),
  target: timeBulkActionRequested,
})

sample({
  clock: timeBulkActionRequested,
  source: {
    ids: $selectedTimeIds,
    projectId: $selectedTimeProjectId,
    pending: $isTimeBulkPending,
  },
  filter: ({ ids, pending }) => ids.length > 0 && !pending,
  fn: ({ ids, projectId }, action) => ({ action, ids: [...ids], projectId }),
  target: bulkAccepted,
})
sample({
  clock: timeBulkDeleteRequested,
  source: $isTimeBulkPending,
  filter: (pending, ids) => !pending && ids.length > 0,
  fn: (_, ids): BulkRequest => ({
    action: 'delete',
    ids: [...ids],
    projectId: null,
  }),
  target: bulkAccepted,
})
sample({
  clock: bulkAccepted,
  filter: ({ action }) => action === 'paid' || action === 'unpaid',
  fn: ({ ids, action }) => ({ ids, isPaid: action === 'paid' }),
  target: setTimePaidStatusMutation.start,
})
sample({
  clock: bulkAccepted,
  filter: ({ action, projectId }) => action === 'invoice' && Boolean(projectId),
  fn: ({ ids, projectId }) => ({ projectId: projectId!, timeIds: ids }),
  target: invoiceSelectedTimeMutation.start,
})
sample({
  clock: bulkAccepted,
  filter: ({ action, projectId }) => action === 'invoice' && !projectId,
  fn: () => ({
    type: 'info' as const,
    messageKey: 'dashboard.worklogsTable.bulk.invoiceOneProject',
  }),
  target: showToastFx,
})
sample({
  clock: bulkAccepted,
  filter: ({ action }) =>
    action === 'delete' ||
    action === 'remove-screenshots' ||
    action === 'remove-processes',
  target: confirmBulkFx,
})

// Original attached-effect params are the IDs the user actually confirmed.
sample({
  clock: confirmBulkFx.done,
  source: $mutationPending,
  filter: (pending, { params }) => !pending && params.action === 'delete',
  fn: (_, { params }) => params.ids,
  target: deleteTimeMutation.start,
})
sample({
  clock: confirmBulkFx.done,
  source: $mutationPending,
  filter: (pending, { params }) =>
    !pending && params.action === 'remove-screenshots',
  fn: (_, { params }) => params.ids,
  target: removeTimeScreenshotMutation.start,
})
sample({
  clock: confirmBulkFx.done,
  source: $mutationPending,
  filter: (pending, { params }) =>
    !pending && params.action === 'remove-processes',
  fn: (_, { params }) => params.ids,
  target: removeTimeProcessesMutation.start,
})

sample({
  clock: setTimePaidStatusMutation.finished.success,
  source: $activeBulk,
  filter: (request, { params }) =>
    Boolean(
      request &&
        (request.action === 'paid' || request.action === 'unpaid') &&
        isSameTimeSelection(request.ids, params.ids),
    ),
  target: bulkOperationSucceeded,
})
sample({
  clock: deleteTimeMutation.finished.success,
  source: $activeBulk,
  filter: (request, { params }) =>
    Boolean(
      request?.action === 'delete' && isSameTimeSelection(request.ids, params),
    ),
  target: bulkOperationSucceeded,
})
sample({
  clock: removeTimeScreenshotMutation.finished.success,
  source: $activeBulk,
  filter: (request, { params }) =>
    Boolean(
      request?.action === 'remove-screenshots' &&
        isSameTimeSelection(request.ids, params),
    ),
  target: bulkOperationSucceeded,
})
sample({
  clock: removeTimeProcessesMutation.finished.success,
  source: $activeBulk,
  filter: (request, { params }) =>
    Boolean(
      request?.action === 'remove-processes' &&
        isSameTimeSelection(request.ids, params),
    ),
  target: bulkOperationSucceeded,
})
sample({
  clock: invoiceSelectedTimeMutation.finished.success,
  source: $activeBulk,
  filter: (request, { params }) =>
    Boolean(
      request?.action === 'invoice' &&
        isSameTimeSelection(request.ids, params.timeIds),
    ),
  target: bulkOperationSucceeded,
})
sample({ clock: bulkOperationSucceeded, target: timeSelectionCleared })

sample({
  clock: setTimePaidStatusMutation.finished.success,
  fn: () => ({
    type: 'success' as const,
    messageKey: 'dashboard.worklogsTable.paymentStatus.changed',
  }),
  target: showToastFx,
})
sample({
  clock: setTimePaidStatusMutation.finished.success,
  target: setTimePaidStatusMutation.reset,
})
sample({
  clock: deleteTimeMutation.finished.success,
  fn: () => ({
    type: 'success' as const,
    messageKey: 'dashboard.worklogsTable.bulk.deletedMessage',
  }),
  target: showToastFx,
})
sample({
  clock: deleteTimeMutation.finished.success,
  target: deleteTimeMutation.reset,
})
sample({
  clock: deleteTimeMutation.finished.success,
  source: $selectedTimeId,
  filter: (id, { params }) => Boolean(id && params.includes(id)),
  target: timeDialogClosed,
})
