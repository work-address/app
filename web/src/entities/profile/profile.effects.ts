import { createEffect } from 'effector'

import { baseApi, renewSession, runApiData } from '@/shared'

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

const readStatus = () => runApiData(() => baseApi.authControllerStatus())

/**
 * The status route never refuses: a token that identifies nobody gets an empty
 * answer, and an expired one looks the same. So the token is renewed from here,
 * since no 401 will do it, and an empty answer is never taken for a profile.
 */
export const fetchStatusFx = createEffect(async () => {
  const user = await readStatus()

  if (user) {
    return user
  }

  await renewSession()

  const renewed = await readStatus()

  if (!renewed) {
    throw new Error('The session was renewed but identifies nobody')
  }

  return renewed
})

export const saveTokensFx = createEffect(
  (headers: { authorization: string; refreshToken: string }) => {
    localStorage.setItem(LOCAL_STORAGE_ACCESS_TOKEN, headers.authorization)
    localStorage.setItem(LOCAL_STORAGE_REFRESH_TOKEN, headers.refreshToken)
  },
)

const clearTokens = () => {
  localStorage.removeItem(LOCAL_STORAGE_ACCESS_TOKEN)
  localStorage.removeItem(LOCAL_STORAGE_REFRESH_TOKEN)
  localStorage.removeItem(LOCAL_STORAGE_AUTH_KEY)
}

export const clearTokensFx = createEffect(clearTokens)

/**
 * Ends a session by reloading the page, because nothing less clears it. Every
 * feature keeps what it read in stores that live as long as the page does, and a
 * request can still be on its way, so without this the next account to sign in
 * here would open on the last one's invoices and filters.
 *
 * Tokens go first, so the reload comes back signed out. `path` replaces the
 * current entry, dropping where the person was; without it the reload stays put
 * and the sign-in redirect remembers the page, to come back to it.
 */
export const restartAppFx = createEffect((path?: string) => {
  clearTokens()

  if (path) {
    window.history.replaceState(null, '', path)
  }

  window.location.reload()
})

export const writeAuthenticatedToLsFx = createEffect((value: boolean) => {
  if (value) {
    localStorage.setItem(LOCAL_STORAGE_AUTH_KEY, value.toString())
  } else {
    localStorage.removeItem(LOCAL_STORAGE_AUTH_KEY)
  }
})
