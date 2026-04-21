import { combine, createStore } from 'effector'

import {
  disconnectEthFx,
  ethDisconnectedPub,
  loginEthFx,
  signEthFx,
} from './eth.model'
import {
  fetchStatusFx,
  getNonceFx,
  LOCAL_STORAGE_AUTH_KEY,
} from './profile.effects'
import { login, logout, setInitialized } from './profile.events'
import { disconnectTonFx, loginTonFx, tonDisconnected } from './ton.model'

import type { EthModalResult } from './eth.model'
import type { LoginMode } from './types'
import type { baseApi } from '@/features/shared'

export const $loginMode = createStore<LoginMode | null>(null).on(
  login,
  (_, payload) => payload,
)

export const $ethProviderData = createStore<EthModalResult | null>(null).reset(
  loginEthFx.done,
)

export const $authenticated = createStore(
  Boolean(localStorage.getItem(LOCAL_STORAGE_AUTH_KEY)),
)
  .on([ethDisconnectedPub, tonDisconnected], () => false)
  .on([loginEthFx.done, loginTonFx.done], () => true)
  .on(fetchStatusFx.done, () => true)

export const $user = createStore<baseApi.User | null>(null)
  .on(fetchStatusFx.doneData, (_, user) => user)
  .reset(logout)

export const $initialized = createStore(false).on(setInitialized, () => true)

export const $pending = combine(
  getNonceFx.pending,
  signEthFx.pending,
  disconnectEthFx.pending,
  disconnectTonFx.pending,
  fetchStatusFx.pending,
  loginEthFx.pending,
  loginTonFx.pending,
).map((state) => state.some(Boolean))
