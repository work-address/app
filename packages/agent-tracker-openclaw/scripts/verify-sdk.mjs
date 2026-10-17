// Run against an unpacked or installed openclaw@2026.10.4 package.
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'
import assert from 'node:assert/strict'
import { register } from '../dist/plugin.js'
import { OpenClawAdapter, OPENCLAW_VERSION } from '../dist/index.js'

const root = resolve(process.argv[2] ?? '')
assert.equal(
  JSON.parse(readFileSync(join(root, 'package.json'))).version,
  OPENCLAW_VERSION,
)
const directory = mkdtempSync(join(tmpdir(), 'wa-sdk-check-'))
try {
  const types = join(root, 'dist/plugin-sdk/plugin-entry.js')
  const diagnosticTypes = join(root, 'dist/plugin-sdk/diagnostic-runtime.js')
  const plugin = resolve('packages/agent-tracker-openclaw/dist/plugin.js')
  writeFileSync(
    join(directory, 'check.mts'),
    `
    import type { OpenClawPluginApi } from ${JSON.stringify(types)};
    import type * as Sdk from ${JSON.stringify(diagnosticTypes)};
    import { register, type DiagnosticSdk } from ${JSON.stringify(plugin)};
    const registration: (api: OpenClawPluginApi) => void = register;
    const sdk: DiagnosticSdk = {} as typeof Sdk;
    void registration; void sdk;
  `,
  )
  execFileSync(
    process.execPath,
    [
      'node_modules/typescript/bin/tsc',
      '--noEmit',
      '--strict',
      '--skipLibCheck',
      '--target',
      'ES2022',
      '--module',
      'NodeNext',
      '--moduleResolution',
      'NodeNext',
      join(directory, 'check.mts'),
    ],
    { stdio: 'inherit' },
  )
  let sdk
  if (process.argv.includes('--dispatcher-only')) {
    // Unpacked npm tarballs lack native dependencies needed by the full facade.
    // Exercise its actual diagnostic dispatcher without booting the gateway.
    const facade = readFileSync(diagnosticTypes, 'utf8')
    const match = facade.match(
      /import \{([^}]+)\} from \"(\.\.\/diagnostic-events-[^\"]+)\"/,
    )
    if (!match) throw new Error('Pinned SDK facade changed')
    const internal = await import(
      new URL(match[2], pathToFileURL(diagnosticTypes)).href
    )
    sdk = Object.fromEntries(
      match[1].split(',').map((binding) => {
        const [key, name] = binding.trim().split(/\s+as\s+/)
        return [name ?? key, internal[key]]
      }),
    )
  } else sdk = await import(pathToFileURL(diagnosticTypes).href)
  const adapter = new OpenClawAdapter({
    projectId: '677cf211-c57d-49ce-aa82-23fd013bed14',
    instanceId: '9c5cd0ba-a35c-4b97-a4d7-8925f52a17be',
  })
  const events = []
  const unsubscribe = sdk.onInternalDiagnosticEvent(
    (event, metadata) => {
      if (metadata.trusted) events.push(adapter.normalize(event))
    },
    { include: ['run.started', 'run.completed'] },
  )
  try {
    sdk.emitDiagnosticEvent({ type: 'run.started', runId: 'spoofed' })
    sdk.emitTrustedDiagnosticEvent({ type: 'run.started', runId: 'sdk-smoke' })
    sdk.emitTrustedDiagnosticEvent({
      type: 'run.completed',
      runId: 'sdk-smoke',
      durationMs: 1,
      outcome: 'completed',
    })
    await sdk.waitForDiagnosticEventsDrained()
    assert.equal(events.length, 2)
    assert.equal(events[0].runId, events[1].runId)
  } finally {
    unsubscribe()
  }
  assert.equal(typeof register, 'function')
  console.log(
    'Pinned SDK types and real diagnostic dispatcher passed (synthetic events, no model run).',
  )
} finally {
  rmSync(directory, { recursive: true, force: true })
}
