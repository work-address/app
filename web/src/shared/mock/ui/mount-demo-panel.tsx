import { createRoot } from 'react-dom/client'

import { DemoPanel } from './demo-panel'

/** Renders the demo panel in a root of its own, beside the app's. */
export function mountDemoPanel() {
  const host = document.createElement('div')
  host.id = 'demo-panel'
  document.body.append(host)
  createRoot(host).render(<DemoPanel />)
}
