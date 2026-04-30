import { createClient } from '@hey-api/openapi-ts'
import fs from 'node:fs'

const { VITE_API_URL } = process.env

const outputDir = 'src/shared/api/generated'

if (fs.existsSync(outputDir)) {
  fs.rmSync(outputDir, { recursive: true, force: true })
}

await createClient({
  input: `${VITE_API_URL}/api/help/openApi`,
  output: outputDir,
  plugins: ['@hey-api/client-axios'],
})
