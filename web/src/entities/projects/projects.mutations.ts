import { createMutation } from '@farfetched/core'

import type { ProjectCadenceInput } from './types'

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

/**
 * States a new version of a project's cadence. Owner only - the API answers
 * 403 to anyone else, and the drawer only offers the form to the owner.
 */
export const setProjectCadenceMutation = createMutation({
  handler: ({
    projectId,
    cadence,
  }: {
    projectId: string
    cadence: ProjectCadenceInput
  }) =>
    runApi(() =>
      baseApi.projectControllerSetCadence({
        path: { id: projectId as never },
        body: cadence,
      }),
    ),
})

/**
 * Records the reader's own answer to automatic issuance. Never anyone
 * else's: it is consent to a financial document being raised in your name.
 */
export const setProjectCadenceConsentMutation = createMutation({
  handler: ({
    projectId,
    consented,
  }: {
    projectId: string
    consented: boolean
  }) =>
    runApi(() =>
      baseApi.projectControllerSetCadenceConsent({
        path: { id: projectId as never },
        body: { consented },
      }),
    ),
})
