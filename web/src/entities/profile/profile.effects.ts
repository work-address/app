import { createEffect } from 'effector'

import type { GetNonceParams } from './types'

import { baseApi, runApiData } from '@/shared'

export const LOCAL_STORAGE_AUTH_KEY = 'authenticated'
export const LOCAL_STORAGE_ACCESS_TOKEN = 'access_token'
export const LOCAL_STORAGE_REFRESH_TOKEN = 'refresh_token'

export const fetchStatusFx = createEffect(() =>
  runApiData(() => baseApi.authControllerStatus()),
)

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
  if (params.mode === 'ton') {
    return baseApi
      .authControllerTonNonce()
      .then((response) => response.data as string)
  }

  return baseApi
    .authControllerNonce({ body: { address: params.address } })
    .then((response) => response.data as string)
})
