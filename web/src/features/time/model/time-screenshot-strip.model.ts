import { createEvent, createStore, sample } from 'effector'

import { timeDialogClosed } from './time-table.model'

import { deleteTimeMutation } from '@/entities/time'

/**
 * Which of the strip's entries is open. Held by id, not by position: the strip
 * is read again after every change to an entry, and an entry that has left it
 * (deleted, or its screenshot removed) must not hand its place to a neighbour.
 */
export const stripEntryOpened = createEvent<string>()
export const stripEntryClosed = createEvent()

// A saved edit closes the dialog wherever it is open.
export const $stripEntryId = createStore<string | null>(null)
  .on(stripEntryOpened, (_, id) => id)
  .reset(stripEntryClosed, timeDialogClosed)

sample({
  clock: deleteTimeMutation.finished.success,
  source: $stripEntryId,
  filter: (id, { params }) => id !== null && params.includes(id),
  target: stripEntryClosed,
})
