/**
 * Auth orchestration module.
 * Coordinates login flows, session management, and side effects.
 * Pure business logic - all state lives in auth.stores.ts, events in auth.events.
 */

import { sample } from 'effector'

import { loginEthFx } from './eth.model'
import { loginGoogleFx } from './google.model'
import {
  clearTokensFx,
  fetchStatusFx,
  LOCAL_STORAGE_ACCESS_TOKEN,
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

import { suppressGlobalErrorToast } from '@/shared'

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
 * On session validation failure (401), clear tokens and reset auth state.
 */
sample({
  clock: fetchStatusFx.fail,
  target: [$authenticated.reinit, logout],
})

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
