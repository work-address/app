import { createMutation } from '@farfetched/core'

import { baseApi, runApi } from '@/shared'

/**
 * `rate` is a nullable numeric column, so clearing it has to travel as null -
 * an empty string is not castable to numeric and would fail the save. The
 * generated `User` types it as `string | undefined` because the entity carries
 * `@IsString()`, so the payload widens it here rather than at every call site.
 */
type SaveProfileParams = Omit<baseApi.User, 'rate'> & {
  rate?: string | null
}

export const saveProfileMutation = createMutation({
  handler: async (params: SaveProfileParams) => {
    return runApi(() =>
      baseApi.userControllerEdit({
        body: params as baseApi.UserEdit,
      }),
    )
  },
})
