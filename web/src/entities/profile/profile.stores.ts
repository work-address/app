import { combine, createStore } from 'effector'

import {
  disconnectEthFx,
  ethDisconnectedPub,
  loginEthFx,
  signEthFx,
} from './eth.model'
import {
  clearTokensFx,
  fetchStatusFx,
  getNonceFx,
  LOCAL_STORAGE_AUTH_KEY,
  saveTokensFx,
} from './profile.effects'
import { login, logout, setInitialized } from './profile.events'
import { saveProfileMutation } from './profile.mutations'
import { getNonceSolanaFx, loginSolanaFx, signSolanaFx } from './solana.model'
import {
  disconnectTonFx,
  loginTonFx,
  openTonModalFx,
  tonDisconnected,
} from './ton.model'

import type { EthModalResult } from './eth.model'
import type { LoginMode } from './types'

import { getFriendlyWalletAddress, type baseApi } from '@/shared'

export const $loginMode = createStore<LoginMode | null>(null)
  .on(login, (_, payload) => payload)
  .reset(logout)

export const $ethProviderData = createStore<EthModalResult | null>(null).reset(
  loginEthFx.done,
  logout,
)

export const $authenticated = createStore(
  Boolean(localStorage.getItem(LOCAL_STORAGE_AUTH_KEY)),
)
  .on(logout, () => false)
  .on([ethDisconnectedPub, tonDisconnected], () => false)
  .on([loginEthFx.done, loginTonFx.done, loginSolanaFx.done], () => true)
  .on(fetchStatusFx.done, () => true)

export const $user = createStore<baseApi.User | null>(null)
  .on(fetchStatusFx.doneData, (_, user) => user)
  .on(saveProfileMutation.finished.success, (state, { params: user }) => ({
    ...state,
    ...user,
  }))
  .reset(logout)

export const $normalizedUser = $user.map((user) =>
  user
    ? {
        ...user,
        // TODO: set chain property on backend after authentication
        friendlyWalletAddress: getFriendlyWalletAddress(user?.address),
      }
    : null,
)

export const $initialized = createStore(false).on(setInitialized, () => true)

export const $headers = createStore<{
  access: string | null
  refresh: string | null
}>({ access: null, refresh: null })
  .on(saveTokensFx, (_, payload) => ({
    access: payload.authorization,
    refresh: payload.refreshToken,
  }))
  .on(clearTokensFx, () => ({ access: null, refresh: null }))

export const $pending = combine(
  getNonceFx.pending,
  openTonModalFx.pending,
  signEthFx.pending,
  disconnectEthFx.pending,
  disconnectTonFx.pending,
  fetchStatusFx.pending,
  loginEthFx.pending,
  loginTonFx.pending,
  getNonceSolanaFx.pending,
  signSolanaFx.pending,
  loginSolanaFx.pending,
).map((state) => state.some(Boolean))
