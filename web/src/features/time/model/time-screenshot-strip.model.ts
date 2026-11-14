import { createTimeEntryPicker } from './time-entry-picker.model'

const strip = createTimeEntryPicker()

/** Which of the screenshot strip's entries is open. */
export const stripEntryOpened = strip.opened
export const stripEntryClosed = strip.closed
export const $stripEntryId = strip.$id
