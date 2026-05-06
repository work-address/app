import fs from 'fs'
import path from 'path'

import '@/app/app'
import { OpenApi } from '@/service/open-api'

const spec = new OpenApi().buildSpec()
const output = path.resolve(
  __dirname,
  '../../../packages/api-client/openapi.json',
)

fs.mkdirSync(path.dirname(output), { recursive: true })
fs.writeFileSync(output, JSON.stringify(spec, null, 2), 'utf-8')

console.log(`Wrote ${output}`)
