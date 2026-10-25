/* eslint-disable no-console -- a build step; its output is the point */
// Fails a production build that carries the demo layer (docs/demo-mode.md).
//
// `main.tsx` guards the mock API with literals Vite inlines, so a plain
// `pnpm build` should emit no msw, no faker and no demo panel. A refactor that
// tests an imported value instead would quietly ship all of them; this check
// catches that. `public/mockServiceWorker.js` is a static file copied as is and
// is never loaded without demo mode, so only the bundled chunks are read.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const assets = fileURLToPath(new URL('../dist/assets/', import.meta.url))
const MARKERS = [
  'setupWorker',
  'mockServiceWorker',
  '@faker-js',
  'wa.demo.settings',
]

if (process.env.VITE_DEMO === 'true') {
  console.log('demo build: the demo layer is meant to be in it')
  process.exit(0)
}

const leaks = []
for (const file of readdirSync(assets)) {
  if (!file.endsWith('.js')) {
    continue
  }
  const source = readFileSync(join(assets, file), 'utf8')
  for (const marker of MARKERS) {
    if (source.includes(marker)) {
      leaks.push(`${file}: ${marker}`)
    }
  }
}

if (leaks.length > 0) {
  console.error(
    'The production build carries the demo layer:\n' + leaks.join('\n'),
  )
  process.exit(1)
}
console.log('production build is free of the demo layer')
