import { createMutation } from '@farfetched/core'
import { AxiosError } from 'axios'

import { baseApi } from '@/shared'

export const deleteTimeMutation = createMutation({
  handler: async (ids: string[]) => {
    const result = await baseApi.timeControllerDelete({
      body: { ids },
    })

    if (result instanceof AxiosError) {
      throw result
    }

    return result
  },
})

export const editTimeMutation = createMutation({
  handler: async ({
    id,
    note,
    isPaid,
  }: {
    id: string
    note: string
    isPaid: boolean
  }) => {
    const result = await baseApi.timeControllerEdit({
      path: { id: id as never },
      body: { note, isPaid },
    })

    if (result instanceof AxiosError) {
      throw result
    }

    return result
  },
})

export const removeTimeScreenshotMutation = createMutation({
  handler: async (ids: string[]) => {
    const result = await baseApi.timeControllerRemoveScreenshots({
      body: { ids },
    })

    if (result instanceof AxiosError) {
      throw result
    }

    return result
  },
})

export const setTimePaidStatusMutation = createMutation({
  handler: async ({ ids, isPaid }: { ids: string[]; isPaid: boolean }) => {
    const result = isPaid
      ? await baseApi.timeControllerMarkPaid({ body: { ids } })
      : await baseApi.timeControllerMarkUnpaid({ body: { ids } })

    if (result instanceof AxiosError) {
      throw result
    }

    return result
  },
})

export const removeTimeProcessesMutation = createMutation({
  handler: async (ids: string[]) => {
    const result = await baseApi.timeControllerRemoveProcesses({
      body: { ids },
    })

    if (result instanceof AxiosError) {
      throw result
    }

    return result
  },
})
