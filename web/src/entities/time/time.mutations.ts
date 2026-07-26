import { createMutation } from '@farfetched/core'
import { AxiosError } from 'axios'

import { baseApi } from '@/shared'

export const deleteWorklogMutation = createMutation({
  handler: async (id: string) => {
    const result = await baseApi.timeControllerDelete({
      path: { id: id as never },
    })

    if (result instanceof AxiosError) {
      throw result
    }

    return result
  },
})

export const editWorklogMutation = createMutation({
  handler: async ({ id, note }: { id: string; note: string }) => {
    const result = await baseApi.timeControllerEdit({
      path: { id: id as never },
      body: { note },
    })

    if (result instanceof AxiosError) {
      throw result
    }

    return result
  },
})

export const removeWorklogScreenshotMutation = createMutation({
  handler: async (id: string) => {
    const result = await baseApi.timeControllerRemoveScreenshot({
      path: { id: id as never },
    })

    if (result instanceof AxiosError) {
      throw result
    }

    return result
  },
})

export const removeWorklogProcessesMutation = createMutation({
  handler: async (id: string) => {
    const result = await baseApi.timeControllerRemoveProcesses({
      path: { id: id as never },
    })

    if (result instanceof AxiosError) {
      throw result
    }

    return result
  },
})
