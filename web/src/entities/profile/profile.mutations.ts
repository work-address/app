import { createMutation } from '@farfetched/core'

import { baseApi, runApi } from '@/shared'

/**
 * Email and rate are nullable columns; clearing a value travels as null.
 * `rate` is numeric, so
 * an empty string is not castable to numeric and would fail the save. The
 * generated `User` types it as `string | undefined` because the entity carries
 * `@IsString()`, so the payload widens it here rather than at every call site.
 */
type SaveProfileParams = Omit<baseApi.User, 'rate' | 'email'> & {
  email?: string | null
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
