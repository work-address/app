import { createMutation } from '@farfetched/core'
import { AxiosError } from 'axios'

import { baseApi } from '@/shared'

export const deleteWorklogMutation = createMutation({
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

export const editWorklogMutation = createMutation({
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

export const removeWorklogScreenshotMutation = createMutation({
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

export const setWorklogPaidStatusMutation = createMutation({
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

export const removeWorklogProcessesMutation = createMutation({
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
