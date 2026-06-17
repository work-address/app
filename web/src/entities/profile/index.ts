/**
 * Auth orchestration module.
 * Coordinates login flows, session management, and side effects.
 * Pure business logic - all state lives in auth.stores.ts, events in auth.events.
 */

import { combine, sample, split } from 'effector'

import { getAuthErrorMessage } from './auth-errors'
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
  saveTokensFx,
  writeAuthenticatedToLsFx,
} from './profile.effects'
import { initAuth, login, logout, setInitialized } from './profile.events'
import { saveProfileMutation } from './profile.mutations'
import {
  $authenticated,
  $ethProviderData,
  $initialized,
  $loginMode,
} from './profile.stores'
import {
  disconnectSolanaFx,
  loginSolanaFx,
  openSolanaModalFx,
  signSolanaFx,
  solanaConnectedPub,
  solanaConnectError,
} from './solana.model'
import {
  disconnectTonFx,
  loginTonFx,
  openTonModalFx,
  tonAuthError,
  tonAuthSuccess,
} from './ton.model'

import type { SolanaNonceParams } from '@/entities/profile/types.ts'

import { showToast } from '@/shared'

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
    solana: (mode) => mode === 'solana',
  },
  cases: {
    eth: openEthModalFx,
    ton: getNonceFx.prepend(() => ({
      mode: 'ton',
    })),
    solana: openSolanaModalFx,
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
 * ETH flow: after wallet connects, and we're in login mode (no provider data yet),
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
    ethersProvider: providerData?.ethersProvider,
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
 * Solana flow: after wallet connected (and user intends to log in),
 * fetch nonce for the connected address, sign it, then verify on backend.
 */
sample({
  clock: solanaConnectedPub,
  source: combine($authenticated, $loginMode),
  filter: ([authenticated, mode]) => !authenticated && mode === 'solana',
  fn: (_, { address }): SolanaNonceParams => ({ address, mode: 'solana' }),
  target: getNonceFx,
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

sample({
  clock: initAuth,
  source: $authenticated,
  filter: (auth) => !auth,
  target: [disconnectEthFx, disconnectTonFx, disconnectSolanaFx],
})

/**
 * After successful login (either provider), persist tokens to localStorage.
 */
sample({
  clock: [loginEthFx.doneData, loginTonFx.doneData, loginSolanaFx.doneData],
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
 * Logout flow: disconnect both wallet providers, clear tokens
 */
sample({
  clock: logout,
  target: [disconnectTonFx, disconnectEthFx, disconnectSolanaFx, clearTokensFx],
})

sample({
  clock: getNonceFx.done,
  filter: ({ params }) => params.mode === 'solana',
  fn: ({ result }) => result,
  target: signSolanaFx,
})

sample({
  clock: signSolanaFx.doneData,
  target: loginSolanaFx,
})

sample({
  clock: signSolanaFx.fail,
  target: solanaConnectError,
})

sample({
  clock: [
    signEthFx.fail,
    loginEthFx.fail,
    tonAuthError,
    openTonModalFx.fail,
    loginTonFx.fail,
    signSolanaFx.fail,
    loginSolanaFx.fail,
    solanaConnectError,
  ],
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
  target: logout,
})

sample({
  clock: saveProfileMutation.finished.success,
  target: fetchStatusFx,
})

/**
 * Toast notifications for auth events.
 * Replace with proper UI feedback or remove if handled by components.
 */

loginTonFx.done.watch(() => {
  showToast('success', {
    message: 'Ton login successful.',
    position: 'top-center',
  })
})

openTonModalFx.fail.watch(({ error }) => {
  const message = getAuthErrorMessage(error, 'Ton login error')

  if (!message) {
    return
  }

  showToast('error', {
    message,
    position: 'top-center',
  })
})

loginTonFx.fail.watch(({ error }) => {
  const message = getAuthErrorMessage(error, 'Ton login error')

  if (!message) {
    return
  }

  showToast('error', {
    message,
    position: 'top-center',
  })
})

tonAuthError.watch(() => {
  showToast('error', {
    message: 'Ton auth error.',
    position: 'top-center',
  })
})

loginEthFx.done.watch(() => {
  showToast('success', {
    message: 'Ethereum login successful.',
    position: 'top-center',
  })
})

sample({
  clock: [signEthFx.fail, loginEthFx.fail],
}).watch(() => {
  showToast('error', {
    message: 'Ethereum login error.',
    position: 'top-center',
  })
})

loginSolanaFx.done.watch(() => {
  showToast('success', {
    message: 'Solana login successful.',
    position: 'top-center',
  })
})

sample({
  clock: [signSolanaFx.fail, loginSolanaFx.fail, solanaConnectError],
}).watch(() => {
  showToast('error', {
    message: 'Solana connection error.',
    position: 'top-center',
  })
})

// eslint-disable-next-line
;(window as any)['logout'] = logout

export { type LoginMode } from './types'

export { initAuth, login, logout } from './profile.events'
export {
  clearTokensFx,
  fetchStatusFx,
  saveTokensFx,
  connectTimeTrackerFx,
} from './profile.effects'
export {
  $authenticated,
  $initialized,
  $pending,
  $normalizedUser as $user,
} from './profile.stores'
export { saveProfileMutation } from './profile.mutations'
