import { AxiosError } from 'axios'
import { createEffect, createEvent, createStore } from 'effector'

import type { AuthorizationHeaders } from './types'

import { baseApi, runApi, runApiData, suppressGlobalErrorToast } from '@/shared'

/**
 * Which sign-in methods this deployment offers is the API's to say at runtime,
 * so one build serves a deployment that can reach Google and one that can't.
 */
export const fetchAuthMethodsFx = createEffect(() =>
  runApiData(() => baseApi.authControllerMethods()),
)

// The sign-in page says so itself, with a way to ask again.
fetchAuthMethodsFx.failData.watch(suppressGlobalErrorToast)

/**
 * Starts at `loading`, so the page knows not to draw a wallet-only screen
 * before the deployment has answered. A later fetch keeps what is on screen,
 * unless it is the retry after a failure.
 */
export const $authMethodsState = createStore<'loading' | 'ready' | 'failed'>(
  'loading',
)
  .on(fetchAuthMethodsFx, (state) => (state === 'failed' ? 'loading' : state))
  .on(fetchAuthMethodsFx.done, () => 'ready')
  .on(fetchAuthMethodsFx.fail, () => 'failed')

export const $googleClientId = createStore<string | null>(null).on(
  fetchAuthMethodsFx.doneData,
  (_, methods) => methods.googleClientId ?? null,
)

export const googleScriptLoaded = createEvent()
export const googleScriptLoadFailed = createEvent()
export const retryGoogleScript = createEvent()

export const $googleScriptState = createStore<'loading' | 'ready' | 'failed'>(
  'loading',
)
  .on(googleScriptLoaded, () => 'ready')
  .on(googleScriptLoadFailed, () => 'failed')
  .reset(retryGoogleScript)

export const $googleScriptAttempt = createStore(0).on(
  retryGoogleScript,
  (attempt) => attempt + 1,
)

/** Swaps Google's credential for the same session a wallet sign-in gets. */
export const loginGoogleFx = createEffect(
  async (credential: string): Promise<AuthorizationHeaders> => {
    const result = await runApi(() =>
      baseApi.authControllerLoginGoogle({ body: { credential } }),
    )

    return {
      authorization: result.headers['authorization'],
      refreshToken: result.headers['refresh-token'],
    }
  },
)

export type GoogleSignInError =
  | 'emailTaken'
  | 'emailUnverified'
  | 'failed'
  | 'unavailable'

/**
 * Why Google sign-in failed, from the API's exception name. No response at
 * all, or a 5xx, means the service is down rather than the person refused.
 */
export const toGoogleSignInError = (error: unknown): GoogleSignInError => {
  if (!(error instanceof AxiosError)) {
    return 'failed'
  }

  const status = error.response?.status

  if (status === undefined || status >= 500) {
    return 'unavailable'
  }

  const name = (error.response?.data as { name?: unknown } | undefined)?.name

  if (name === 'GoogleEmailTakenException') {
    return 'emailTaken'
  }

  if (name === 'GoogleEmailUnverifiedException') {
    return 'emailUnverified'
  }

  return 'failed'
}

/** Google's own button reporting a failure before the API was ever asked. */
export const googleButtonFailed = createEvent()

export const $googleSignInError = createStore<GoogleSignInError | null>(null)
  .on(loginGoogleFx.failData, (_, error) => toGoogleSignInError(error))
  .on(googleButtonFailed, () => 'failed')
  .reset(loginGoogleFx)
