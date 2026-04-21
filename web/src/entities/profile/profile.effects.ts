import { AxiosError } from 'axios'
import { createEffect } from 'effector'

import type { GetNonceParams } from './types'

import { baseApi } from '@/features/shared'

export const LOCAL_STORAGE_AUTH_KEY = 'authenticated'
export const LOCAL_STORAGE_ACCESS_TOKEN = 'access_token'
export const LOCAL_STORAGE_REFRESH_TOKEN = 'refresh_token'

export const fetchStatusFx = createEffect(async () => {
  const result = await baseApi.authControllerStatus()

  if (result instanceof AxiosError) {
    throw result
  }

  return result.data
})

export const saveTokensFx = createEffect(
  (headers: { authorization: string; refreshToken: string }) => {
    localStorage.setItem(LOCAL_STORAGE_ACCESS_TOKEN, headers.authorization)
    localStorage.setItem(LOCAL_STORAGE_REFRESH_TOKEN, headers.refreshToken)
  },
)

export const clearTokensFx = createEffect(() => {
  localStorage.removeItem(LOCAL_STORAGE_ACCESS_TOKEN)
  localStorage.removeItem(LOCAL_STORAGE_REFRESH_TOKEN)
  localStorage.removeItem(LOCAL_STORAGE_AUTH_KEY)
})

export const writeAuthenticatedToLsFx = createEffect((value: boolean) => {
  if (value) {
    localStorage.setItem(LOCAL_STORAGE_AUTH_KEY, value.toString())
  } else {
    localStorage.removeItem(LOCAL_STORAGE_AUTH_KEY)
  }
})

export const getNonceFx = createEffect(async (params: GetNonceParams) => {
  if (params.mode === 'eth') {
    return baseApi
      .authControllerNonce({ body: { address: params.address } })
      .then((response) => response.data as string)
  } else {
    return baseApi
      .authControllerNonce()
      .then((response) => response.data as string)
  }
})
