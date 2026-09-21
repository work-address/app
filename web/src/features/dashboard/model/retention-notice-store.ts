import { createEffect, createStore } from 'effector'

import type { RetentionNotice } from './retention-notice'

import { baseApi, runApiData } from '@/shared'

/** Loads what rotates out of the caller's history soon. */
export const fetchRetentionNoticeFx = createEffect(
  (): Promise<RetentionNotice> =>
    runApiData(() => baseApi.timeControllerRetentionNotice()),
)

/**
 * The last notice loaded. A failed load keeps the previous one rather than
 * clearing it: a notice that is only sometimes shown is worse than one a
 * little stale, and the next dashboard visit reloads it.
 */
export const $retentionNotice = createStore<RetentionNotice | null>(null).on(
  fetchRetentionNoticeFx.doneData,
  (_, notice) => notice,
)
