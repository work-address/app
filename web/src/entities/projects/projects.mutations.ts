import { createMutation } from '@farfetched/core'

import { baseApi, runApi } from '@/shared'

export const createProjectMutation = createMutation({
  handler: async (project: baseApi.Project) => {
    return runApi(() =>
      baseApi.projectControllerCreate({
        body: project,
      }),
    )
  },
})

export const deleteProjectMutation = createMutation({
  handler: async (id: string) => {
    return runApi(() =>
      baseApi.projectControllerDelete({
        path: { id: id as never },
      }),
    )
  },
})

export const editProjectMutation = createMutation({
  handler: async (project: baseApi.Project) => {
    return runApi(() =>
      baseApi.projectControllerEdit({
        path: {
          id: project.id as never,
        },
        body: project,
      }),
    )
  },
})
