import { createMutation } from '@farfetched/core'

import { baseApi, runApi } from '@/shared'

export const deleteTimeMutation = createMutation({
  handler: async (ids: string[]) => {
    return runApi(() =>
      baseApi.timeControllerDelete({
        body: { ids },
      }),
    )
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
    return runApi(() =>
      baseApi.timeControllerEdit({
        path: { id: id as never },
        body: { note, isPaid },
      }),
    )
  },
})

export const removeTimeScreenshotMutation = createMutation({
  handler: async (ids: string[]) => {
    return runApi(() =>
      baseApi.timeControllerRemoveScreenshots({
        body: { ids },
      }),
    )
  },
})

export const setTimePaidStatusMutation = createMutation({
  handler: async ({ ids, isPaid }: { ids: string[]; isPaid: boolean }) => {
    return runApi(() =>
      isPaid
        ? baseApi.timeControllerMarkPaid({ body: { ids } })
        : baseApi.timeControllerMarkUnpaid({ body: { ids } }),
    )
  },
})

export const removeTimeProcessesMutation = createMutation({
  handler: async (ids: string[]) => {
    return runApi(() =>
      baseApi.timeControllerRemoveProcesses({
        body: { ids },
      }),
    )
  },
})
