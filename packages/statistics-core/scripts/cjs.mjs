import { writeFileSync } from 'node:fs'
writeFileSync(
  new URL('../dist-cjs/package.json', import.meta.url),
  JSON.stringify({ type: 'commonjs' }),
)
