/**
 * Starts the demo: seeds the session and puts the mock API in front of every
 * request. Loaded only behind the demo guard in `main.tsx`.
 */
import { setupWorker } from 'msw/browser'

import { handlers } from './handlers'
import { demoScreenshots } from './images'
import { seedDemoSession } from './session'
import { readDemoSettings } from './settings'
import { demoDb } from './store'

export const worker = setupWorker(...handlers)

let started: Promise<void> | null = null

export function startDemoMode(): Promise<void> {
  if (started) {
    return started
  }
  seedDemoSession()
  // Build the world and draw the screenshots now, not in the first request.
  demoDb()
  demoScreenshots()
  started = worker
    .start({
      // Vite serves `public/` from the root; anything the handlers do not
      // claim (modules, fonts, wallets) goes to the network untouched.
      serviceWorker: { url: '/mockServiceWorker.js' },
      onUnhandledFrame: 'bypass',
      quiet: true,
    })
    .then(() => {
      const { role, world } = readDemoSettings()
      // eslint-disable-next-line no-console -- the one line that says why nothing reaches the API
      console.info(
        `[demo] mock API on: ${role}, ${world} world (docs/demo-mode.md)`,
      )
    })
  return started
}
