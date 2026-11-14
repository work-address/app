#!/usr/bin/env node
/*
 * The live check an agent passes before it is "Available" on servers
 * (SERVER-RUNTIMES.md, "Live check"). Run it on a test server where the agent
 * is installed with its Work Address hooks or plugin:
 *
 *   node packages/agent-tracker/scripts/live-check.mjs <product> <agent-release>
 *
 * It starts a loopback receiver, sets up a fresh collector against it and
 * prints the environment to start the agent with. For each scenario it waits
 * while you run the agent in another terminal, uploads what was queued, judges
 * it, and keeps the events as fixtures in test/live/<product>/<release>/.
 * Use throwaway prompts: a prompt the agent sends is kept in the fixture.
 */
import { execFile, spawnSync } from 'node:child_process'
import { promisify } from 'node:util'
import { randomUUID } from 'node:crypto'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { fileURLToPath } from 'node:url'
import { findAgentSupport } from '@work-address/agent-tracking-contract/support'
import { createMockReceiver } from '../examples/mock-ingest.mjs'
import { SCENARIOS, judge } from './live-scenarios.mjs'

const ASK = {
  success: 'Run one turn that ends normally.',
  failure:
    'Run one turn that fails: an unknown model, or a tool that exits non-zero.',
  interruption: 'Start a turn and stop it yourself (Ctrl+C or Esc).',
  concurrency: 'Run two turns at the same time, in two sessions.',
}

const [product, release] = process.argv.slice(2)
const support = product && findAgentSupport(product)
if (!support || !release || !/^[\w.+-]{1,64}$/.test(release)) {
  console.error(
    'Usage: live-check.mjs <claude-code|codex|openclaw|hermes|kimi-code> <agent-release>',
  )
  process.exit(1)
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const cli = join(root, 'dist', 'cli.js')
const state = mkdtempSync(join(tmpdir(), 'wa-live-'))
const credential = `live-check-${randomUUID()}`
let events = []
const server = createMockReceiver({
  credential,
  onEvent: (event) => events.push(event),
})
await new Promise((done) => server.listen(0, '127.0.0.1', done))
const endpoint = `http://127.0.0.1:${server.address().port}/api/agent-tracking/events`

const env = {
  ...process.env,
  NODE_NO_WARNINGS: '1',
  WORK_ADDRESS_STATE_DIR: state,
  WORK_ADDRESS_EXPERIMENTAL_ADAPTERS: '1',
  WORK_ADDRESS_RUNTIME_VERSION: release,
}
const setup = spawnSync(
  process.execPath,
  [cli, 'setup', endpoint, randomUUID()],
  { env, input: credential, encoding: 'utf8' },
)
if (setup.status !== 0) {
  console.error('Collector setup failed:', setup.stderr)
  process.exit(1)
}

// The agent's hooks call `agent-tracker`: this build, first on the PATH.
const bin = join(state, 'bin')
mkdirSync(bin)
writeFileSync(
  join(bin, 'agent-tracker'),
  `#!/bin/sh\nexec "${process.execPath}" "${cli}" "$@"\n`,
  { mode: 0o755 },
)

console.log(`\nLive check for ${support.name} ${release}.`)
console.log('Start the agent from a shell with these set:\n')
for (const name of [
  'WORK_ADDRESS_STATE_DIR',
  'WORK_ADDRESS_EXPERIMENTAL_ADAPTERS',
  'WORK_ADDRESS_RUNTIME_VERSION',
])
  console.log(`export ${name}=${JSON.stringify(env[name])}`)
console.log(`export PATH=${JSON.stringify(bin)}:"$PATH"\n`)

const out = join(root, 'test', 'live', product, release)
mkdirSync(out, { recursive: true })
const prompt = createInterface({ input: process.stdin, output: process.stdout })
const results = []
try {
  for (const scenario of SCENARIOS) {
    events = []
    await prompt.question(
      `${scenario}: ${ASK[scenario]} Press Enter when done. `,
    )
    // Not spawnSync: the receiver runs in this process and must answer.
    await promisify(execFile)(process.execPath, [cli, 'sync'], { env }).catch(
      () => console.log('  sync left events queued; judging what arrived'),
    )
    const result = judge(scenario, events, support.servers.limits)
    results.push({ scenario, ...result })
    console.log(
      `  ${result.ok ? 'ok' : 'NOT OK'} (${result.verdict}): ${result.reason}`,
    )
    writeFileSync(
      join(out, `${scenario}.json`),
      JSON.stringify({ product, release, scenario, events }, null, 2) + '\n',
    )
  }
} finally {
  prompt.close()
  server.close()
  rmSync(state, { recursive: true, force: true })
}

const passed = results.every((result) => result.ok)
writeFileSync(
  join(out, 'README.md'),
  `# ${support.name} ${release}\n\nLive check of ${new Date().toISOString().slice(0, 10)} on ${process.platform}/${process.arch}, Node ${process.version}.\n\n${results
    .map(
      (r) =>
        `- ${r.scenario}: ${r.ok ? 'ok' : 'not ok'} (${r.verdict}) — ${r.reason}`,
    )
    .join('\n')}\n`,
)
console.log(
  passed
    ? `\nPassed. Fixtures are in ${out}. Set servers.status to "available" and add ${release} to servers.versions in agent-tracking-contract/src/support.ts.`
    : `\nNot passed. Fixtures are in ${out} for a look; do not mark ${support.name} available.`,
)
process.exit(passed ? 0 : 1)
