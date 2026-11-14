import { createTimeEntryPicker } from './time-entry-picker.model'

const map = createTimeEntryPicker()

/** Which of the locations map's entries is open. */
export const mapEntryOpened = map.opened
export const mapEntryClosed = map.closed
export const $mapEntryId = map.$id
