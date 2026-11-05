import { combine, createStore } from 'effector'

import { loginEthFx } from './eth.model'
import { loginGoogleFx } from './google.model'
import {
  fetchStatusFx,
  LOCAL_STORAGE_AUTH_KEY,
  readLastSignInMethod,
  type SignInMethod,
} from './profile.effects'
import { logout, setInitialized, signOut } from './profile.events'
import { saveProfileMutation } from './profile.mutations'

import type { baseApi } from '@/shared'

export const $authenticated = createStore(
  Boolean(localStorage.getItem(LOCAL_STORAGE_AUTH_KEY)),
)
  .on(logout, () => false)
  .on([loginEthFx.done, loginGoogleFx.done], () => true)
  .on(fetchStatusFx.done, () => true)

// Someone who chose to leave starts over at the dashboard next time; a session
// that ran out goes back to where it was.
export const $signedOutOnPurpose = createStore(false)
  .on(signOut, () => true)
  .reset([loginEthFx.done, loginGoogleFx.done])

export const $lastSignInMethod = createStore<SignInMethod | null>(
  readLastSignInMethod(),
)
  .on(loginEthFx.done, () => 'wallet')
  .on(loginGoogleFx.done, () => 'google')

export const $user = createStore<baseApi.User | null>(null)
  .on(fetchStatusFx.doneData, (_, user) => user)
  .on(saveProfileMutation.finished.success, (state, { params: user }) => ({
    ...state,
    ...user,
    // A cleared rate is sent as null to blank the numeric column; on the user
    // shape "unset" is undefined, so it is folded back here.
    rate: user.rate ?? undefined,
    email: user.email === undefined ? state?.email : user.email,
  }))
  .reset(logout)

export const $initialized = createStore(false).on(setInitialized, () => true)

export const $pending = combine(
  fetchStatusFx.pending,
  loginEthFx.pending,
  loginGoogleFx.pending,
).map((state) => state.some(Boolean))
