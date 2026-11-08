/**
 * Auth orchestration module.
 * Coordinates login flows, session management, and side effects.
 * Pure business logic - all state lives in auth.stores.ts, events in auth.events.
 */

import { sample } from 'effector'
import { delay } from 'patronum/delay'

import { loginEthFx } from './eth.model'
import { loginGoogleFx } from './google.model'
import {
  clearTokensFx,
  fetchStatusFx,
  LOCAL_STORAGE_ACCESS_TOKEN,
  restartAppFx,
  saveTokensFx,
  writeAuthenticatedToLsFx,
  writeLastSignInMethodFx,
} from './profile.effects'
import { initAuth, logout, setInitialized, signOut } from './profile.events'
import { saveProfileMutation } from './profile.mutations'
import {
  $authenticated,
  $initialized,
  $lastSignInMethod,
} from './profile.stores'

import { routes } from '@/routes'
import { sessionExpired, suppressGlobalErrorToast } from '@/shared'

const STATUS_RETRY_MS = 15_000

/**
 * Persist auth flag to localStorage for backward compatibility.
 * TODO: remove after full migration to token-only session checks.
 */
sample({
  clock: $authenticated,
  target: writeAuthenticatedToLsFx,
})

/**
 * After successful login, persist tokens to localStorage.
 */
sample({
  clock: [loginEthFx.doneData, loginGoogleFx.doneData],
  target: saveTokensFx,
})

/**
 * After tokens saved, fetch current user profile to populate $user store.
 */
sample({
  clock: saveTokensFx.done,
  target: fetchStatusFx,
})

sample({
  clock: $lastSignInMethod,
  filter: Boolean,
  target: writeLastSignInMethodFx,
})

sample({
  clock: signOut,
  target: logout,
})

sample({
  clock: signOut,
  fn: () => routes.signIn.build(),
  target: restartAppFx,
})

// A failed sign-in also gets a refusal, with no session to end and its error to
// show, so only a session this page still believes in counts.
const sessionRanOut = sample({
  clock: sessionExpired,
  source: $authenticated,
  filter: Boolean,
  fn: () => {},
})

sample({
  clock: sessionRanOut,
  target: [logout, restartAppFx],
})

/**
 * Logout flow: clear tokens
 */
sample({
  clock: logout,
  target: clearTokensFx,
})

sample({
  clock: [loginEthFx.fail, loginGoogleFx.fail],
  target: logout,
})

/**
 * App initialization: validate existing session on app mount.
 * Only runs once (guarded by $initialized) and only if access token exists.
 */
sample({
  clock: initAuth,
  source: $initialized,
  filter: (initialized) =>
    !initialized && Boolean(localStorage.getItem(LOCAL_STORAGE_ACCESS_TOKEN)),
  target: [fetchStatusFx, setInitialized.prepend(() => true)],
})

/**
 * A failed read says nothing about the session: a real refusal ends it through
 * `sessionExpired`, so what reaches here is an outage. Everyone stays signed in
 * and it is read again, because too much hangs off knowing who they are.
 */
sample({
  clock: delay(fetchStatusFx.fail, STATUS_RETRY_MS),
  source: $authenticated,
  filter: Boolean,
  fn: () => {},
  target: fetchStatusFx,
})

// Quiet, or an outage would raise a toast at every retry. Each page says for
// itself that it could not load.
fetchStatusFx.failData.watch(suppressGlobalErrorToast)

sample({
  clock: saveProfileMutation.finished.success,
  target: fetchStatusFx,
})

// profile-edit.tsx already shows its own toast on save failure.
saveProfileMutation.finished.failure.watch(({ error }) => {
  suppressGlobalErrorToast(error)
})

// The Google button shows these in place, in `$googleSignInError`'s words.
loginGoogleFx.failData.watch(suppressGlobalErrorToast)

// eslint-disable-next-line
;(window as any)['logout'] = logout

export { initAuth, logout, signOut } from './profile.events'
export { clearTokensFx, fetchStatusFx, saveTokensFx } from './profile.effects'
export {
  $authenticated,
  $initialized,
  $lastSignInMethod,
  $pending,
  $signedOutOnPurpose,
  $user,
} from './profile.stores'
export { saveProfileMutation } from './profile.mutations'
// `loginEthFx` is the tail of the browser wallet's sign-in: that feature signs
// the nonce itself and hands the signature here, so it gets the same token
// handling, status fetch and failure path as Google.
export { loginEthFx } from './eth.model'
export {
  $authMethodsState,
  $googleClientId,
  $googleScriptAttempt,
  $googleScriptState,
  $googleSignInError,
  fetchAuthMethodsFx,
  googleButtonFailed,
  googleScriptLoaded,
  googleScriptLoadFailed,
  loginGoogleFx,
  retryGoogleScript,
} from './google.model'
export type { GoogleSignInError } from './google.model'
