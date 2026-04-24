import { createMutation } from '@farfetched/core'
import { AxiosError } from 'axios'

import { baseApi } from '@/features/shared'

export const saveProfileMutation = createMutation({
  handler: async (params: baseApi.User) => {
    const result = await baseApi.userControllerEdit({
      body: params,
    })

    if (result instanceof AxiosError) {
      throw result
    }

    return result
  },
})
