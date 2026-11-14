import { createEvent, createStore, sample } from 'effector'

import { timeDialogClosed } from './time-table.model'

import { deleteTimeMutation } from '@/entities/time'

/**
 * Which of a widget's entries has its dialog open. Held by id, not by
 * position: the widget is read again after every change to an entry, and an
 * entry that has left it (deleted, or its detail removed) must not hand its
 * place to a neighbour. Each widget has its own, so opening an entry in one
 * never reaches another's.
 */
export const createTimeEntryPicker = () => {
  const opened = createEvent<string>()
  const closed = createEvent()

  // A saved edit closes the dialog wherever it is open.
  const $id = createStore<string | null>(null)
    .on(opened, (_, id) => id)
    .reset(closed, timeDialogClosed)

  sample({
    clock: deleteTimeMutation.finished.success,
    source: $id,
    filter: (id, { params }) => id !== null && params.includes(id),
    target: closed,
  })

  return { opened, closed, $id }
}
