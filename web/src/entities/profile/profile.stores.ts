import { combine, createStore } from 'effector'

import {
  disconnectEthFx,
  ethDisconnectedPub,
  loginEthFx,
  openEthModalFx,
  signEthFx,
} from './eth.model'
import {
  fetchStatusFx,
  getNonceFx,
  LOCAL_STORAGE_AUTH_KEY,
} from './profile.effects'
import { login, logout, setInitialized } from './profile.events'
import { saveProfileMutation } from './profile.mutations'
import { loginSolanaFx, openSolanaModalFx, signSolanaFx } from './solana.model'
import {
  disconnectTonFx,
  loginTonFx,
  openTonModalFx,
  tonDisconnected,
} from './ton.model'

import type { EthModalResult, LoginMode } from './types'

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
    // A cleared rate is sent as null to blank the numeric column; on the user
    // shape "unset" is undefined, so it is folded back here.
    rate: user.rate ?? undefined,
    email: user.email === undefined ? state?.email : user.email,
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

export const $pending = combine(
  getNonceFx.pending,
  openTonModalFx.pending,
  openEthModalFx.pending,
  openSolanaModalFx.pending,
  signEthFx.pending,
  disconnectEthFx.pending,
  disconnectTonFx.pending,
  fetchStatusFx.pending,
  loginEthFx.pending,
  loginTonFx.pending,
  signSolanaFx.pending,
  loginSolanaFx.pending,
).map((state) => state.some(Boolean))
