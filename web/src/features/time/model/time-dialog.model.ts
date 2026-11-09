import { attach, createEvent, sample } from 'effector'

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
 * confirm in the app. The entry's id travels as the attached effect's own
 * parameter, because the dialog resolves with its props, not with what the
 * user was acting on.
 */
const createEntryConfirmFlow = (
  translationPrefix: string,
  target: EventCallable<string[]>,
): EventCallable<string> => {
  const requested = createEvent<string>()
  const confirmEntryFx = attach({
    effect: confirmFx,
    mapParams: (_id: string) => ({
      title: translate(`${translationPrefix}.title`),
      description: translate(`${translationPrefix}.description`),
      confirmLabel: translate(`${translationPrefix}.confirm`),
      cancelLabel: translate('common.cancel'),
    }),
  })

  sample({ clock: requested, target: confirmEntryFx })

  sample({
    clock: confirmEntryFx.done,
    fn: ({ params: id }) => [id],
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
