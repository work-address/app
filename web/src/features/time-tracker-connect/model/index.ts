import { combine, sample } from 'effector'
import { createEffect } from 'effector'
import i18n from 'i18next'

import { initTimeTrackerConnect } from './events'
import {
  connectTimeTrackerFx,
  fetchTimeTrackerNonceFx,
} from './effects'
import { $nonce, $phase } from './stores'
import {
  getTimeTrackerNonceStorageKey,
  TIME_TRACKER_CONNECTED_STATE,
} from './types'

import { $authenticated } from '@/entities/profile'
import { showToast } from '@/shared'

const writeNonceMarkerFx = createEffect((nonce: string) => {
  localStorage.setItem(getTimeTrackerNonceStorageKey(nonce), '1')
})

sample({
  clock: initTimeTrackerConnect,
  target: fetchTimeTrackerNonceFx,
})

sample({
  clock: fetchTimeTrackerNonceFx.done,
  filter: ({ result }) => result.state === TIME_TRACKER_CONNECTED_STATE,
  fn: () => 'connected' as const,
  target: $phase,
})

sample({
  clock: fetchTimeTrackerNonceFx.done,
  source: $authenticated,
  filter: (authenticated, { result }) =>
    result.state !== TIME_TRACKER_CONNECTED_STATE && !authenticated,
  fn: () => 'awaiting_auth' as const,
  target: $phase,
})

sample({
  clock: fetchTimeTrackerNonceFx.done,
  source: $authenticated,
  filter: (authenticated, { result }) =>
    result.state !== TIME_TRACKER_CONNECTED_STATE && authenticated,
  fn: () => 'awaiting_pair' as const,
  target: $phase,
})

sample({
  clock: fetchTimeTrackerNonceFx.done,
  source: $authenticated,
  filter: (authenticated, { result }) =>
    authenticated && result.state !== TIME_TRACKER_CONNECTED_STATE,
  fn: (_, { params }) => params,
  target: connectTimeTrackerFx,
})

sample({
  clock: $authenticated,
  source: combine($authenticated, $phase, $nonce),
  filter: ([authenticated, phase, nonce]) =>
    authenticated && phase === 'awaiting_auth' && Boolean(nonce),
  fn: ([, , nonce]) => nonce!,
  target: connectTimeTrackerFx,
})

sample({
  clock: connectTimeTrackerFx.done,
  fn: ({ params }) => params,
  target: writeNonceMarkerFx,
})

connectTimeTrackerFx.done.watch(() => {
  showToast('success', {
    message: i18n.t('connect.toast.success'),
    position: 'top-center',
  })
})

export {
  initTimeTrackerConnect,
  resetTimeTrackerConnect,
} from './events'
export { $nonce, $phase, $errorMessage, $errorName } from './stores'
export type { TimeTrackerConnectPhase } from './types'
export { getTimeTrackerNonceStorageKey } from './types'
