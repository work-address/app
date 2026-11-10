import { createEffect } from 'effector'

import type { TimeTrackerNonceData } from './types'

import { baseApi, runApi, runApiData } from '@/shared'

export const fetchTimeTrackerNonceFx = createEffect(
  async (nonce: string): Promise<TimeTrackerNonceData> => {
    return runApiData(
      () =>
        baseApi.authTimeTrackerControllerTimeTrackerNonceGet({
          path: { nonce },
        }),
      // The page explains a failed pairing itself.
      'in-place',
    )
  },
)

export const connectTimeTrackerFx = createEffect(async (nonce: string) => {
  await runApi(
    () =>
      baseApi.authTimeTrackerControllerTimeTrackerConnect({
        body: { nonce },
        path: { nonce },
      }),
    'in-place',
  )
})
