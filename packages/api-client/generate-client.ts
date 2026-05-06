import fs from 'node:fs'
import path from 'node:path'

/** Resolved relative to cwd (`pnpm codegen` runs with cwd = this package). */
const packageRoot = process.cwd()

const API_URL = process.env.API_URL ?? 'http://localhost:4000'

const specFromRepo = path.join(packageRoot, 'openapi.json')
const outputDir = path.join(packageRoot, 'src/features/shared/api/generated')

async function generate(): Promise<void> {
  const { createClient } = await import('@hey-api/openapi-ts')

  if (fs.existsSync(outputDir)) {
    fs.rmSync(outputDir, { recursive: true, force: true })
  }

  const input =
    process.env.OPENAPI_INPUT ??
    (fs.existsSync(specFromRepo)
      ? specFromRepo
      : `${API_URL}/api/help/openApi`)

  await createClient({
    input,
    output: outputDir,
    plugins: ['@hey-api/client-axios'],
  })
}

generate().catch((err: unknown) => {
  console.error(err)
  process.exitCode = 1
})
