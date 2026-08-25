import { attach, createEvent, createStore, sample } from 'effector'

import { timeDialogClosed } from './time-table.model'

import type { EventCallable } from 'effector'

import {
  deleteTimeMutation,
  editTimeMutation,
  removeTimeProcessesMutation,
  removeTimeScreenshotMutation,
} from '@/entities/time'
import { confirmFx, translate } from '@/shared'

/**
 * Builds "ask, then act on the open entry" as a unit graph. Each flow gets its
 * own attached confirm effect so `.done` identifies which confirm was
 * answered - confirmFx is shared app-wide and its own `.done` fires for every
 * confirm in the app. The id is parked in a store because the dialog resolves
 * with its own props, not with what the user was acting on.
 */
const createEntryConfirmFlow = (
  translationPrefix: string,
  target: EventCallable<string[]>,
): EventCallable<string> => {
  const requested = createEvent<string>()
  const confirmEntryFx = attach({ effect: confirmFx })

  const $pendingId = createStore<string | null>(null)
    .on(requested, (_, id) => id)
    .reset(confirmEntryFx.finally)

  sample({
    clock: requested,
    fn: () => ({
      title: translate(`${translationPrefix}.title`),
      description: translate(`${translationPrefix}.description`),
      confirmLabel: translate(`${translationPrefix}.confirm`),
      cancelLabel: translate('common.cancel'),
    }),
    target: confirmEntryFx,
  })

  sample({
    clock: confirmEntryFx.done,
    source: $pendingId,
    filter: (id): id is string => id !== null,
    fn: (id: string) => [id],
    target,
  })

  return requested
}

export const timeEntryDeleteRequested = createEntryConfirmFlow(
  'dashboard.worklogsTable.confirmDelete',
  deleteTimeMutation.start,
)

export const timeScreenshotRemoveRequested = createEntryConfirmFlow(
  'dashboard.worklogsTable.confirmRemoveScreenshot',
  removeTimeScreenshotMutation.start,
)

export const timeProcessesRemoveRequested = createEntryConfirmFlow(
  'dashboard.worklogsTable.confirmRemoveProcesses',
  removeTimeProcessesMutation.start,
)

// A successful edit closes the dialog; the feed patches the row itself, so
// there is nothing to copy back into the form.
sample({
  clock: editTimeMutation.finished.success,
  target: [timeDialogClosed, editTimeMutation.reset],
})

sample({
  clock: removeTimeScreenshotMutation.finished.success,
  target: removeTimeScreenshotMutation.reset,
})

sample({
  clock: removeTimeProcessesMutation.finished.success,
  target: removeTimeProcessesMutation.reset,
})
