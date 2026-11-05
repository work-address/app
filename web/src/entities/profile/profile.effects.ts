import { createEffect } from 'effector'

import { baseApi, runApiData } from '@/shared'

export const LOCAL_STORAGE_AUTH_KEY = 'authenticated'
export const LOCAL_STORAGE_ACCESS_TOKEN = 'access_token'
export const LOCAL_STORAGE_REFRESH_TOKEN = 'refresh_token'
export const LOCAL_STORAGE_LAST_SIGN_IN_METHOD = 'wa.last-sign-in-method'

export type SignInMethod = 'google' | 'wallet'

/**
 * How this browser last signed in. Only the method, and it outlives signing
 * out, because the two methods are separate accounts and a returning person
 * needs telling which one they used.
 */
export const readLastSignInMethod = (): SignInMethod | null => {
  const stored = localStorage.getItem(LOCAL_STORAGE_LAST_SIGN_IN_METHOD)

  return stored === 'google' || stored === 'wallet' ? stored : null
}

export const writeLastSignInMethodFx = createEffect((method: SignInMethod) => {
  localStorage.setItem(LOCAL_STORAGE_LAST_SIGN_IN_METHOD, method)
})

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
