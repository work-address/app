import fs from 'fs'
import path from 'path'

// First, so the seed is set before the app's decorators draw their examples.
import '@/scripts/seed-openapi-examples'
import '@/app/app'
import { OpenApi } from '@/service/open-api'

/**
 * Writes the OpenAPI spec the browser clients are generated from.
 *
 * Usage (from api/): `pnpm run export-openapi [output]`. The output defaults
 * to `packages/api-client/openapi.json`; a path is taken as given, so a
 * check can export somewhere else and compare.
 */
const spec = new OpenApi().buildSpec()
const output = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(__dirname, '../../../packages/api-client/openapi.json')

fs.mkdirSync(path.dirname(output), { recursive: true })
fs.writeFileSync(output, JSON.stringify(spec, null, 2), 'utf-8')

console.log(`Wrote ${output}`)
