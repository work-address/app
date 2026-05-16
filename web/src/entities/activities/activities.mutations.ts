import { createMutation } from '@farfetched/core'
import { AxiosError } from 'axios'

import { baseApi } from '@/shared'

export const createActivityMutation = createMutation({
  handler: async (activity: baseApi.Project) => {
    const result = await baseApi.projectControllerCreate({
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
    const result = await baseApi.projectControllerDelete({
      path: { id: id as never },
    })

    if (result instanceof AxiosError) {
      throw result
    }

    return result
  },
})

export const editActivityMutation = createMutation({
  handler: async (activity: baseApi.Project) => {
    const result = await baseApi.projectControllerEdit({
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
