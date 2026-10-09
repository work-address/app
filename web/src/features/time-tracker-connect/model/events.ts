import { createEvent } from 'effector'

import type { TimeTrackerNonceData } from './types'

export const initTimeTrackerConnect = createEvent<string>()
export const resetTimeTrackerConnect = createEvent()
/** Revalidate the same link before attempting to pair again. */
export const retryTimeTrackerConnect = createEvent()

// Only results for the current page nonce reach the stores and next effects.
export const timeTrackerNonceLoaded = createEvent<{
  params: string
  result: TimeTrackerNonceData
}>()
export const timeTrackerConnected = createEvent<{ params: string }>()
export const timeTrackerConnectFailed = createEvent<{
  params: string
  error: Error
}>()
