/**
 * Auth orchestration module.
 * Coordinates login flows, session management, and side effects.
 * Pure business logic - all state lives in auth.stores, events in auth.events.
 */

import { combine, sample, split } from 'effector'

import {
  disconnectEthFx,
  ethConnectedPub,
  loginEthFx,
  openEthModalFx,
  signEthFx,
} from './eth.model'
import {
  clearTokensFx,
  fetchStatusFx,
  getNonceFx,
  LOCAL_STORAGE_ACCESS_TOKEN,
  saveProfile,
  saveTokensFx,
  writeAuthenticatedToLsFx,
} from './profile.effects'
import { initAuth, login, logout, setInitialized } from './profile.events'
import {
  $authenticated,
  $ethProviderData,
  $initialized,
  $user,
} from './profile.stores'
import {
  disconnectTonFx,
  loginTonFx,
  openTonModalFx,
  tonAuthError,
  tonAuthSuccess,
} from './ton.model'

import { showToast } from '@/features/shared'

/**
 * Route login event to the appropriate wallet flow based on selected provider.
 * ETH: open wallet modal first, nonce fetched after connection established.
 * TON: fetch nonce first, then open modal with proof request attached.
 */
split({
  source: login,
  match: {
    eth: (mode) => mode === 'eth',
    ton: (mode) => mode === 'ton',
  },
  cases: {
    eth: openEthModalFx,
    ton: getNonceFx.prepend(() => ({
      mode: 'ton',
    })),
  },
})

/**
 * TON flow: after nonce received, open wallet modal with proof parameters.
 * Wallet will sign the nonce and return proof payload.
 */
sample({
  clock: getNonceFx.done,
  filter: ({ params }) => params.mode === 'ton',
  fn: ({ result }) => ({ nonce: result }),
  target: openTonModalFx,
})

/**
 * ETH flow: after wallet connects and we're in login mode (no provider data yet),
 * fetch nonce for the connected address to sign.
 */
sample({
  clock: ethConnectedPub,
  source: combine($ethProviderData, $authenticated),
  filter: ([ethProviderData, authenticated]) =>
    ethProviderData === null && !authenticated,
  fn: (_, eventData) => ({
    mode: 'eth' as const,
    address: eventData.address,
    signer: eventData.signer,
  }),
  target: [getNonceFx, $ethProviderData],
})

/**
 * ETH flow: after nonce received, sign it with the connected wallet.
 */
sample({
  clock: getNonceFx.done,
  filter: (_, { params }) => params.mode === 'eth',
  source: $ethProviderData,
  fn: (providerData, { result }) => ({
    nonce: result,
    signer: providerData?.signer,
    ethersProdiver: providerData?.ethersProvider,
  }),
  target: [signEthFx],
})

/**
 * ETH flow: after message signed, send signature to backend for verification.
 */
sample({
  clock: signEthFx.done,
  source: $ethProviderData,
  filter: (ethProviderData, { result: signature }) =>
    Boolean(ethProviderData?.address && signature),
  fn: (ethProviderData, { result: signature }) => ({
    address: ethProviderData?.address || '',
    signature,
  }),
  target: loginEthFx,
})

/**
 * TON flow: after wallet provides valid proof, verify it on backend.
 */
sample({
  clock: tonAuthSuccess,
  target: loginTonFx,
})

/**
 * Persist auth flag to localStorage for backward compatibility.
 * TODO: remove after full migration to token-only session checks.
 */
sample({
  clock: $authenticated,
  target: writeAuthenticatedToLsFx,
})

/**
 * After successful login (either provider), persist tokens to localStorage.
 */
sample({
  clock: [loginEthFx.doneData, loginTonFx.doneData],
  target: saveTokensFx,
})

/**
 * After tokens saved, fetch current user profile to populate $user store.
 */
sample({
  clock: saveTokensFx.done,
  target: fetchStatusFx,
})

/**
 * Logout flow: clear stored tokens.
 */
sample({
  clock: logout,
  target: clearTokensFx,
})

/**
 * Logout flow: disconnect both wallet providers.
 */
sample({
  clock: logout,
  target: [disconnectTonFx, disconnectEthFx],
})

sample({
  clock: [signEthFx.fail, tonAuthError],
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
  target: [clearTokensFx, $authenticated.reinit],
})

sample({
  clock: saveProfile.done,
  fn: ({ params }) => params,
  target: $user,
})

/**
 * Toast notifications for auth events.
 * Replace with proper UI feedback or remove if handled by components.
 */

tonAuthSuccess.watch(() => {
  showToast('success', {
    message: 'Ton login successful.',
    position: 'top-center',
  })
})

tonAuthError.watch(() => {
  showToast('error', {
    message: 'Ton login error',
    position: 'top-center',
  })
})

signEthFx.done.watch(() => {
  showToast('success', {
    message: 'Ethereum login successful.',
    position: 'top-center',
  })
})

signEthFx.fail.watch(() => {
  showToast('error', {
    message: 'Ethereum login error.',
    position: 'top-center',
  })
})

export { type LoginMode } from './types'

export { initAuth, login, logout } from './profile.events'
export {
  clearTokensFx,
  fetchStatusFx,
  saveTokensFx,
  saveProfile,
} from './profile.effects'
export { $authenticated, $initialized, $pending, $user } from './profile.stores'
