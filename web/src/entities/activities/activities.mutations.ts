import { createMutation } from '@farfetched/core'
import { AxiosError } from 'axios'

import { baseApi } from '@/shared'

export const createActivityMutation = createMutation({
  handler: async (activity: baseApi.Activity) => {
    const result = await baseApi.activityControllerCreate({
      body: activity,
    })

    if (result instanceof AxiosError) {
      throw result
    }

    return result
  },
})

export const deleteActivityMutation = createMutation({
  handler: async (id: string) => {
    const result = await baseApi.activityControllerDelete({
      path: { id: id as never },
    })

    if (result instanceof AxiosError) {
      throw result
    }

    return result
  },
})

export const editActivityMutation = createMutation({
  handler: async (activity: baseApi.Activity) => {
    const result = await baseApi.activityControllerEdit({
      path: {
        id: activity.id as never,
      },
      body: activity,
    })

    if (result instanceof AxiosError) {
      throw result
    }

    return result
  },
})
