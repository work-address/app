import { createEvent, createStore, sample } from 'effector'

const COLLAPSED_KEY = 'dashboard_premium_banner_collapsed'

const readCollapsed = (): boolean => {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1'
  } catch {
    // Private windows and blocked site data throw on access rather than
    // returning null. A banner that cannot remember being dismissed is a far
    // smaller problem than a dashboard that will not render.
    return false
  }
}

export const togglePremiumBanner = createEvent()

/**
 * Bring the banner back, regardless of current state.
 *
 * Distinct from the toggle because the header badge is a one-way door: it is
 * shown only while the banner is dismissed, so a toggle there would collapse
 * something the user cannot see.
 */
export const showPremiumBanner = createEvent()

/**
 * Whether the premium banner is dismissed.
 *
 * A store rather than component state because two places render from it - the
 * banner on the dashboard and the "No premium" badge in the header - and local
 * state would let them disagree: dismissing the banner would leave the badge
 * unable to bring it back until a reload.
 */
export const $premiumBannerCollapsed = createStore<boolean>(readCollapsed())
  .on(togglePremiumBanner, (collapsed) => !collapsed)
  .on(showPremiumBanner, () => false)

sample({
  clock: $premiumBannerCollapsed,
  fn: (collapsed) => {
    try {
      localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0')
    } catch {
      // Same reasoning as the read: preference is lost, nothing breaks.
    }

    return collapsed
  },
})
