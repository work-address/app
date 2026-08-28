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
 * Whether the premium banner is collapsed to its header chip.
 *
 * A store rather than component state because two places render from it - the
 * banner on the dashboard and the chip beside the profile button - and local
 * state would let them disagree: collapsing the banner would leave the header
 * showing nothing until a reload.
 */
export const $premiumBannerCollapsed = createStore<boolean>(readCollapsed()).on(
  togglePremiumBanner,
  (collapsed) => !collapsed,
)

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
