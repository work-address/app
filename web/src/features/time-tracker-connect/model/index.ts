import { combine, sample } from 'effector'
import { createEffect } from 'effector'
import i18n from 'i18next'

import { connectTimeTrackerFx, fetchTimeTrackerNonceFx } from './effects'
import {
  initTimeTrackerConnect,
  retryTimeTrackerConnect,
  timeTrackerNonceLoaded,
  timeTrackerConnected,
  timeTrackerConnectFailed,
} from './events'
import { $nonce, $openedByWebsite, $phase } from './stores'
import {
  getTimeTrackerNonceStorageKey,
  TIME_TRACKER_CONNECTED_STATE,
} from './types'

import { $authenticated } from '@/entities/profile'
import { showToast } from '@/shared'

const writeNonceMarkerFx = createEffect((nonce: string) => {
  localStorage.setItem(getTimeTrackerNonceStorageKey(nonce), '1')
})

const announceConnectedFx = createEffect(() => {
  showToast('success', {
    message: i18n.t('connect.toast.success'),
    position: 'top-center',
  })
})

sample({
  clock: initTimeTrackerConnect,
  target: fetchTimeTrackerNonceFx,
})

sample({
  clock: retryTimeTrackerConnect,
  source: combine($nonce, $phase),
  filter: ([nonce, phase]) => Boolean(nonce) && phase === 'error',
  fn: ([nonce]) => nonce!,
  target: initTimeTrackerConnect,
})

sample({
  clock: fetchTimeTrackerNonceFx.done,
  source: $nonce,
  filter: (nonce, { params }) => nonce === params,
  fn: (_, result) => result,
  target: timeTrackerNonceLoaded,
})

sample({
  clock: connectTimeTrackerFx.done,
  source: $nonce,
  filter: (nonce, { params }) => nonce === params,
  fn: (_, { params }) => ({ params }),
  target: timeTrackerConnected,
})

sample({
  clock: [fetchTimeTrackerNonceFx.fail, connectTimeTrackerFx.fail],
  source: $nonce,
  filter: (nonce, { params }) => nonce === params,
  fn: (_, failure) => failure,
  target: timeTrackerConnectFailed,
})

sample({
  clock: timeTrackerNonceLoaded,
  source: $authenticated,
  fn: (authenticated, { result }) =>
    result.state === TIME_TRACKER_CONNECTED_STATE
      ? ('connected' as const)
      : authenticated
        ? ('awaiting_pair' as const)
        : ('awaiting_auth' as const),
  target: $phase,
})

sample({
  clock: timeTrackerNonceLoaded,
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
  clock: timeTrackerConnected,
  fn: ({ params }) => params,
  target: writeNonceMarkerFx,
})

// The website's sign-in closes this tab on success, so nobody would see it.
sample({
  clock: timeTrackerConnected,
  source: $openedByWebsite,
  filter: (openedByWebsite) => !openedByWebsite,
  target: announceConnectedFx,
})

export {
  initTimeTrackerConnect,
  resetTimeTrackerConnect,
  retryTimeTrackerConnect,
  timeTrackerConnectOpenedBy,
} from './events'
export {
  $nonce,
  $openedByWebsite,
  $phase,
  $errorMessage,
  $errorName,
} from './stores'
export type { TimeTrackerConnectPhase } from './types'
export { getTimeTrackerNonceStorageKey } from './types'

export { buildTimeTrackerConnectView } from './view'
export {
  finishWebsiteSignIn,
  leaveForWebsite,
  parseWebsiteReturn,
} from './website-return'
export {
  isPhoneClient,
  PHONE_APP_RETURN_URL,
  returnToPhoneApp,
} from './phone-return'
