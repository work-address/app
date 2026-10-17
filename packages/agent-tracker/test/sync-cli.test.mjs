import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { randomUUID } from 'node:crypto'
import { setup, EventQueue } from '../dist/index.js'
import { createMockReceiver } from '../examples/mock-ingest.mjs'
import { fixture } from './fixture.mjs'

function context(t, endpoint = 'http://127.0.0.1:4199/events') {
  const dir = mkdtempSync(join(tmpdir(), 'wa-sync-cli-'))
  const config = setup(
    dir,
    endpoint,
    fixture.projectId,
    'test-credential-00000',
  )
  const queue = new EventQueue(dir, config)
  const event = {
    ...fixture,
    source: { ...fixture.source, instanceId: config.instanceId },
  }
  t.after(() => {
    queue.close()
    rmSync(dir, { recursive: true, force: true })
  })
  return { dir, queue, event }
}
async function syncCli(directory) {
  const child = spawn(
    process.execPath,
    [fileURLToPath(new URL('../dist/cli.js', import.meta.url)), 'sync'],
    {
      env: {
        ...process.env,
        NODE_NO_WARNINGS: '1',
        WORK_ADDRESS_STATE_DIR: directory,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
  let stdout = '',
    stderr = ''
  child.stdout.on('data', (data) => {
    stdout += data
  })
  child.stderr.on('data', (data) => {
    stderr += data
  })
  const [code] = await once(child, 'exit')
  return { code, status: JSON.parse(stdout), stderr }
}
for (const reason of ['backoff', 'lease', 'rejected'])
  test(`sync exits incomplete when retained events are in ${reason}`, async (t) => {
    const c = context(t)
    c.queue.enqueue(c.event)
    if (reason === 'backoff') c.queue.retry([c.event])
    if (reason === 'lease') c.queue.acquire()
    if (reason === 'rejected')
      c.queue.acknowledge([
        { eventId: c.event.eventId, status: 'rejected', code: 'INVALID' },
      ])
    const result = await syncCli(c.dir)
    assert.equal(result.code, 2)
    assert.equal(result.status.queued + result.status.rejected, 1)
  })

test(
  'sync reports incomplete at its batch cap, then succeeds after the remainder is acknowledged',
  { timeout: 15000 },
  async (t) => {
    const server = createMockReceiver({ credential: 'test-credential-00000' })
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    t.after(() => new Promise((resolve) => server.close(resolve)))
    const c = context(
      t,
      `http://127.0.0.1:${server.address().port}/api/agent-tracking/events`,
    )
    for (let i = 0; i < 1001; i++)
      c.queue.enqueue({ ...c.event, eventId: randomUUID() })
    const incomplete = await syncCli(c.dir)
    assert.equal(incomplete.code, 2)
    assert.equal(incomplete.status.queued, 1)
    const complete = await syncCli(c.dir)
    assert.equal(complete.code, 0)
    assert.equal(complete.status.queued, 0)
  },
)
