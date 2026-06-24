import { AxiosError } from 'axios'
import { createEffect } from 'effector'

import type { TimeTrackerNonceData } from './types'

import { baseApi } from '@/shared'

export const fetchTimeTrackerNonceFx = createEffect(
  async (nonce: string): Promise<TimeTrackerNonceData> => {
    const result = await baseApi.authTimeTrackerControllerTimeTrackerNonceGet({
      path: { nonce },
    })

    if (result instanceof AxiosError) {
      throw result
    }

    return result.data
  },
)

export const connectTimeTrackerFx = createEffect(async (nonce: string) => {
  const result = await baseApi.authTimeTrackerControllerTimeTrackerConnect({
    body: { nonce },
    path: { nonce },
  })

  if (result instanceof AxiosError) {
    throw result
  }
})
