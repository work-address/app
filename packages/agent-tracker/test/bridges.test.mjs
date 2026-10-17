import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { EventQueue, setup, readConfig } from '../dist/index.js'
import { WorkAddress } from '../bridges/opencode/work-address.mjs'

function context(t) {
  const dir = mkdtempSync(join(tmpdir(), 'wa-bridge-'))
  setup(
    dir,
    'http://127.0.0.1:4199/events',
    randomUUID(),
    'test-only-credential-0000',
  )
  const queue = new EventQueue(dir, readConfig(dir))
  // A local executable entry point, equivalent to npm's installed bin link.
  const executable = join(dir, 'collector.mjs')
  writeFileSync(
    executable,
    `#!${process.execPath}\nimport ${JSON.stringify(pathToFileURL(resolve('dist/cli.js')).href)};\n`,
    { mode: 0o700 },
  )
  const env = {
    WORK_ADDRESS_STATE_DIR: dir,
    WORK_ADDRESS_COLLECTOR_BIN: executable,
    WORK_ADDRESS_EXPERIMENTAL_ADAPTERS: '1',
    WORK_ADDRESS_RUNTIME_VERSION: 'fixture',
  }
  t.after(() => {
    queue.close()
    rmSync(dir, { recursive: true, force: true })
  })
  return { dir, queue, env }
}

test('Python Hermes registration delivers real sanitized events to Node SQLite across subprocesses', (t) => {
  const c = context(t)
  const script = `
import work_address_hermes as bridge
hooks = {}
class Context:
    def register_hook(self, name, callback):
        hooks[name] = callback
bridge.register(Context())
data = dict(telemetry_schema_version='hermes.observer.v1', session_id='s', turn_id='t')
assert hooks['pre_llm_call'](**data, user_message='PRIVATE') is None
assert hooks['on_session_end'](**data, completed=True, failed=False, interrupted=False) is None
`
  const result = spawnSync('python3', ['-c', script], {
    encoding: 'utf8',
    timeout: 5000,
    env: {
      ...process.env,
      ...c.env,
      PYTHONDONTWRITEBYTECODE: '1',
      PYTHONPATH: resolve('bridges/hermes'),
    },
  })
  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stderr, '')
  assert.deepEqual(
    c.queue.batch().map((e) => e.eventType),
    ['run.started', 'run.completed'],
  )
})
test('OpenCode plugin forwards status to real Node collector and fails open without an executable', async (t) => {
  const c = context(t)
  const previous = { ...process.env }
  Object.assign(process.env, c.env)
  t.after(() => {
    for (const key of Object.keys(c.env)) {
      if (previous[key] === undefined) delete process.env[key]
      else process.env[key] = previous[key]
    }
  })
  const plugin = await WorkAddress()
  await plugin.event({
    event: {
      type: 'session.status',
      properties: {
        sessionID: 's',
        status: { type: 'busy', prompt: 'PRIVATE' },
      },
    },
  })
  await plugin.event({
    event: {
      type: 'session.status',
      properties: { sessionID: 's', status: { type: 'idle' } },
    },
  })
  assert.deepEqual(
    c.queue.batch().map((e) => e.observedState),
    ['running', 'unknown'],
  )
  assert.equal(JSON.stringify(c.queue.batch()).includes('PRIVATE'), false)
  process.env.WORK_ADDRESS_COLLECTOR_BIN = join(c.dir, 'missing')
  await plugin.event({
    event: { type: 'session.idle', properties: { sessionID: 's' } },
  })
})
