import { createEffect } from 'effector'

import type { AuthorizationHeaders } from './types'

import { baseApi, runApi } from '@/shared'

export const loginEthFx = createEffect(
  async (params: {
    signature: string
    address: string
  }): Promise<AuthorizationHeaders> => {
    const result = await runApi(() =>
      baseApi.authControllerLoginEth({
        body: {
          signature: params.signature,
          address: params.address,
        },
      }),
    )

    return {
      authorization: result.headers['authorization'],
      refreshToken: result.headers['refresh-token'],
    }
  },
)
