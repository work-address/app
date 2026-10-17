import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { OpenClawAdapter, OPENCLAW_VERSION } from '../dist/index.js'
import { register } from '../dist/plugin.js'
import { setup, EventQueue } from '@work-address/agent-tracker'

const options = {
  instanceId: '9c5cd0ba-a35c-4b97-a4d7-8925f52a17be',
  projectId: '677cf211-c57d-49ce-aa82-23fd013bed14',
  epoch: '6021ebe2-7588-4d01-ad6f-3c0881b03dbd',
  now: () => 1792231203000,
}
const fixture = JSON.parse(
  readFileSync(new URL('./fixtures/lifecycle.json', import.meta.url)),
)

test('outer run identity survives optional context changes without counting harness spans', () => {
  const adapter = new OpenClawAdapter(options)
  const events = fixture.events.map((e) => adapter.normalize(e)).filter(Boolean)
  assert.equal(events.length, 2)
  assert.equal(events[0].runId, events[1].runId)
  assert.equal(events[0].sessionId, events[1].sessionId)
  assert.equal(events[1].sourceDurationMs, 2000)
  assert.equal(events[1].eventType, 'run.completed')
})
test('private content, identities and errors are excluded before persistence', () => {
  const adapter = new OpenClawAdapter(options)
  const raw = {
    ...fixture.events[3],
    prompt: 'SENTINEL_PROMPT',
    messages: ['SENTINEL_RESPONSE'],
    error: 'SENTINEL_ERROR',
    sessionKey: 'private@example.com',
    params: { path: '/private/secret' },
  }
  const encoded = JSON.stringify(adapter.normalize(raw))
  for (const secret of [
    'SENTINEL',
    'private@example.com',
    '/private/secret',
    'synthetic-run-1',
  ])
    assert.equal(encoded.includes(secret), false)
})
test('aborted, blocked and failed runs have explicit outcomes', () => {
  const adapter = new OpenClawAdapter(options)
  for (const [outcome, eventType] of [
    ['aborted', 'run.cancelled'],
    ['blocked', 'run.failed'],
    ['error', 'run.failed'],
  ])
    assert.equal(
      adapter.normalize({ ...fixture.events[3], outcome }).eventType,
      eventType,
    )
  assert.throws(() =>
    adapter.normalize({ ...fixture.events[3], outcome: 'maybe' }),
  )
})
test('no synthetic terminal event, clock inference or wait completion', () => {
  const adapter = new OpenClawAdapter(options)
  assert.equal(adapter.normalize(fixture.events[0]).eventType, 'run.started')
  assert.equal(
    adapter.normalize({ type: 'session.state', state: 'idle' }),
    undefined,
  )
  assert.throws(() =>
    adapter.normalize({ ...fixture.events[3], ts: undefined }),
  )
  assert.throws(() =>
    adapter.normalize({ ...fixture.events[3], durationMs: -1 }),
  )
})
test('source replay has stable event IDs within one producer epoch', () => {
  const adapter = new OpenClawAdapter(options)
  assert.deepEqual(
    adapter.normalize(fixture.events[0]),
    adapter.normalize(fixture.events[0]),
  )
})
test('plugin registers an observer service and cleans up on stop', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'wa-openclaw-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const config = setup(
    directory,
    'http://127.0.0.1:4199/events',
    options.projectId,
    'test-credential-000000',
  )
  let service,
    listener,
    unsubscribed = false
  const warnings = []
  register(
    {
      runtime: { version: OPENCLAW_VERSION },
      pluginConfig: { stateDirectory: directory },
      logger: { warn: (text) => warnings.push(text) },
      registerService: (value) => {
        service = value
      },
    },
    async () => ({
      areDiagnosticsEnabledForProcess: () => true,
      onInternalDiagnosticEvent: (callback) => {
        listener = callback
        return () => {
          unsubscribed = true
        }
      },
    }),
  )
  await service.start()
  // Initial sync sees an empty queue; no network request is needed in this test.
  await new Promise((resolve) => setImmediate(resolve))
  listener({ ...fixture.events[0], projectId: 'ignored' }, { trusted: true })
  listener(fixture.events[3], { trusted: false })
  listener({ ...fixture.events[3], ts: 'invalid' }, { trusted: true })
  await service.stop()
  assert.ok(unsubscribed)
  const queue = new EventQueue(directory, config)
  try {
    assert.deepEqual(queue.status(), { queued: 1, rejected: 0, lost: 1 })
  } finally {
    queue.close()
  }
  assert.equal(warnings.length, 1)
})
test('unsupported host version is fail-open and never subscribes', async () => {
  let service,
    subscribed = false
  const warnings = []
  register(
    {
      runtime: { version: '2026.2.9' },
      logger: { warn: (text) => warnings.push(text) },
      registerService: (value) => {
        service = value
      },
    },
    async () => {
      subscribed = true
      throw new Error('unexpected')
    },
  )
  await service.start()
  await service.stop()
  assert.equal(subscribed, false)
  assert.equal(warnings.length, 1)
})
