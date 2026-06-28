import { createMutation } from '@farfetched/core'
import { AxiosError } from 'axios'

import { baseApi } from '@/shared'

export const createProjectMutation = createMutation({
  handler: async (project: baseApi.Project) => {
    const result = await baseApi.projectControllerCreate({
      body: project,
    })

    if (result instanceof AxiosError) {
      throw result
    }

    return result
  },
})

export const deleteProjectMutation = createMutation({
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

export const editProjectMutation = createMutation({
  handler: async (project: baseApi.Project) => {
    const result = await baseApi.projectControllerEdit({
      path: {
        id: project.id as never,
      },
      body: project,
    })

    if (result instanceof AxiosError) {
      throw result
    }

    return result
  },
})
