import { createMutation } from '@farfetched/core'

import { baseApi, runApi } from '@/shared'

export const saveProfileMutation = createMutation({
  handler: async (params: baseApi.User) => {
    return runApi(() =>
      baseApi.userControllerEdit({
        body: params,
      }),
    )
  },
})
