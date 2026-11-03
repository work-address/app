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

// Without an answer the wallet still works, which is all a sign-in page needs.
fetchAuthMethodsFx.failData.watch(suppressGlobalErrorToast)

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
