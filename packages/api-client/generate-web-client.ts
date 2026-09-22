import fs from 'node:fs'
import path from 'node:path'

/**
 * Regenerates the dashboard's API client from the spec exported by the *local*
 * API.
 *
 * `web/src/scripts/generate-client.ts` reads the deployed API instead, so it
 * silently omits any endpoint that has not shipped yet. This script exists for
 * the in-development case, and lives in this package because the web workspace's
 * own copy of `@hey-api/openapi-ts` does not expose an importable entry point.
 *
 * Run `pnpm --filter @app/api-client codegen:web` — the script re-exports the
 * spec from the API first, so it always reflects the current controllers. The
 * export is in the script itself: pnpm runs no `pre` scripts.
 */
const packageRoot = process.cwd()
const specPath = path.join(packageRoot, 'openapi.json')
const outputDir = path.join(
  packageRoot,
  '../../web/src/shared/api/generated',
)

async function generate(): Promise<void> {
  const { createClient } = await import('@hey-api/openapi-ts')

  if (fs.existsSync(outputDir)) {
    fs.rmSync(outputDir, { recursive: true, force: true })
  }

  await createClient({
    input: specPath,
    output: outputDir,
    plugins: ['@hey-api/client-axios'],
  })
}

generate().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
