import { DEMO_MODE } from '@/shared/config'

const ROOT_ELEMENT_ID = 'root'

const ROOT_ELEMENT = document.getElementById(ROOT_ELEMENT_ID)

if (ROOT_ELEMENT === null) {
  throw new Error(
    `No root element in the dom tree. Check if element with id "${ROOT_ELEMENT_ID}" exists`,
  )
}

/**
 * `DEMO_BUILD` is what keeps the demo layer out of a production build: both
 * halves are literals Vite inlines, so a plain `pnpm build` folds the guard to
 * false and never emits the mock chunks. `DEMO_MODE` alone would not - it is
 * an imported value - and the whole of msw would ship.
 */
const DEMO_BUILD = import.meta.env.DEV || import.meta.env.VITE_DEMO === 'true'

const bootstrap = async (root: HTMLElement) => {
  // The demo session has to be in storage before the app's modules load:
  // the auth stores read it as they are created. So the app itself is
  // imported only after the mock API is intercepting.
  if (DEMO_BUILD && DEMO_MODE) {
    const { startDemoMode } = await import('@/shared/mock/browser')
    await startDemoMode()
  }

  const { render } = await import('./app/render')
  render(root)

  // The demo panel sits beside the app in a root of its own.
  if (DEMO_BUILD && DEMO_MODE) {
    const { mountDemoPanel } = await import('@/shared/mock/ui/mount-demo-panel')
    mountDemoPanel()
  }
}

void bootstrap(ROOT_ELEMENT)
