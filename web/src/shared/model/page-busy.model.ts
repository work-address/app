import { createEvent, createStore } from 'effector'

export const pageBusyClaimed = createEvent()
export const pageBusyReleased = createEvent()

const $pageBusyClaims = createStore(0)
  .on(pageBusyClaimed, (claims) => claims + 1)
  .on(pageBusyReleased, (claims) => Math.max(0, claims - 1))

/**
 * Whether anything on the page is reloading the data it already shows, which
 * is what the page indicator runs for besides a route change. Counted, so one
 * reload finishing does not stop the bar while another is still going.
 */
export const $pageBusy = $pageBusyClaims.map((claims) => claims > 0)
