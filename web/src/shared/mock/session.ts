/**
 * The signed-in session a demo starts from. The app reads its tokens from
 * localStorage before anything renders, so seeding them here - before the
 * app mounts - opens the demo on the dashboard instead of the sign-in page.
 *
 * Signing out in the app only clears the tokens; the marker below tells the
 * next load that the visitor signed out, so a reload keeps them signed out
 * until they sign in again (in the app or from the panel).
 */
import { readDemoSettings, writeDemoSettings } from './settings'

export const DEMO_ACCESS_TOKEN = 'demo-access-token'
export const DEMO_REFRESH_TOKEN = 'demo-refresh-token'

const ACCESS_KEY = 'access_token'
const REFRESH_KEY = 'refresh_token'
const AUTHENTICATED_KEY = 'authenticated'
const SEEDED_KEY = 'wa.demo.session'

const store = (fn: () => void) => {
  try {
    fn()
  } catch {
    // Storage disabled: the demo runs signed out.
  }
}

export function signInDemo() {
  writeDemoSettings({ signedOut: false })
  store(() => {
    localStorage.setItem(ACCESS_KEY, DEMO_ACCESS_TOKEN)
    localStorage.setItem(REFRESH_KEY, DEMO_REFRESH_TOKEN)
    localStorage.setItem(AUTHENTICATED_KEY, 'true')
    localStorage.setItem(SEEDED_KEY, '1')
  })
}

export function signOutDemo() {
  writeDemoSettings({ signedOut: true })
  store(() => {
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
    localStorage.removeItem(AUTHENTICATED_KEY)
  })
}

/** Signs the visitor in as the chosen role, unless they signed out. */
export function seedDemoSession() {
  if (readDemoSettings().signedOut) {
    return
  }
  let signedOutInApp = false
  store(() => {
    signedOutInApp =
      localStorage.getItem(SEEDED_KEY) === '1' &&
      localStorage.getItem(ACCESS_KEY) !== DEMO_ACCESS_TOKEN
  })
  if (signedOutInApp) {
    signOutDemo()
    return
  }
  signInDemo()
}
