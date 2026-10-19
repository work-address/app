import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { createServer } from 'node:http'
import { setTimeout as sleep } from 'node:timers/promises'
import { randomUUID } from 'node:crypto'
import {
  drain,
  EventQueue,
  readConfig,
  setup,
  uploadTrigger,
} from '../dist/index.js'
import { fixture } from './fixture.mjs'

const quiet = {
  CLAUDE_CODE_REMOTE: '',
  CI: '',
  CONTINUOUS_INTEGRATION: '',
  GITHUB_ACTIONS: '',
  GITLAB_CI: '',
  BUILDKITE: '',
  CIRCLECI: '',
  JENKINS_URL: '',
}

/** `failures` requests answer 503 before the receiver starts accepting. */
async function receiver(t, failures = 0) {
  const received = []
  let calls = 0
  const server = createServer(async (req, res) => {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    const { events } = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    if (calls++ < failures) {
      res.writeHead(503)
      res.end()
      return
    }
    received.push(...events)
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(
      JSON.stringify({
        results: events.map((e) => ({
          eventId: e.eventId,
          status: 'accepted',
        })),
      }),
    )
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => new Promise((done) => server.close(done)))
  return {
    received,
    calls: () => calls,
    endpoint: `http://127.0.0.1:${server.address().port}/api/agent-tracking/events`,
  }
}

/** An in-process queue with one event in it and no jitter, so backoff is exactly 1 s. */
function queued(t, endpoint) {
  const dir = mkdtempSync(join(tmpdir(), 'wa-drain-'))
  const config = setup(
    dir,
    endpoint,
    fixture.projectId,
    'test-credential-00000',
  )
  const queue = new EventQueue(dir, config, { random: () => 0 })
  const event = {
    ...fixture,
    source: { ...fixture.source, instanceId: config.instanceId },
  }
  queue.enqueue(event)
  t.after(() => {
    queue.close()
    rmSync(dir, { recursive: true, force: true })
  })
  return { dir, queue, config, event }
}

function collector(t, endpoint) {
  const dir = mkdtempSync(join(tmpdir(), 'wa-hook-upload-'))
  setup(dir, endpoint, randomUUID(), 'test-credential-00000')
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  // Asynchronous, so the in-process receiver can answer while the hook runs.
  const hook = async (name, env = {}) => {
    const child = spawn(
      process.execPath,
      [resolve('dist/cli.js'), 'hook', 'claude-code'],
      {
        env: {
          ...process.env,
          ...quiet,
          NODE_NO_WARNINGS: '1',
          WORK_ADDRESS_STATE_DIR: dir,
          WORK_ADDRESS_EXPERIMENTAL_ADAPTERS: '1',
          ...env,
        },
      },
    )
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (data) => (stdout += data))
    child.stderr.on('data', (data) => (stderr += data))
    child.stdin.end(JSON.stringify({ hook_event_name: name, session_id: 's' }))
    const [status] = await once(child, 'close')
    return { status, stdout, stderr }
  }
  const status = () => {
    const queue = new EventQueue(dir, readConfig(dir))
    try {
      return queue.status()
    } finally {
      queue.close()
    }
  }
  return { hook, status }
}

test('session boundaries and stops start uploads; CI and cloud stops flush first', () => {
  for (const name of ['SessionStart', 'SessionEnd', 'Stop', 'on_session_end'])
    assert.equal(uploadTrigger(name, quiet), 'detached')
  for (const name of ['UserPromptSubmit', 'TurnStarted', 'busy', undefined])
    assert.equal(uploadTrigger(name, quiet), 'none')
  assert.equal(uploadTrigger('Stop', { ...quiet, CI: 'true' }), 'flush')
  assert.equal(uploadTrigger('Stop', { CLAUDE_CODE_REMOTE: 'true' }), 'flush')
  assert.equal(uploadTrigger('Stop', { ...quiet, CI: 'false' }), 'detached')
  // SessionEnd budgets are about a second; never wait on the network there.
  assert.equal(uploadTrigger('SessionEnd', { CI: '1' }), 'detached')
  assert.equal(uploadTrigger('Stop', { WORK_ADDRESS_HOOK_UPLOAD: '0' }), 'none')
})

test('a CI Stop hook delivers the run before it returns', async (t) => {
  const r = await receiver(t)
  const c = collector(t, r.endpoint)
  assert.equal((await c.hook('UserPromptSubmit')).status, 0)
  assert.equal(r.received.length, 0)
  const stop = await c.hook('Stop', { CI: 'true' })
  assert.equal(stop.status, 0)
  assert.equal(stop.stdout.trim(), '{}')
  assert.equal(stop.stderr, '')
  assert.deepEqual(
    r.received.map((e) => e.eventType),
    ['run.started', 'run.observed'],
  )
  assert.deepEqual(c.status(), { queued: 0, rejected: 0, lost: 0 })
})

test('a Stop hook returns at once and a detached uploader drains the queue', async (t) => {
  const r = await receiver(t)
  const c = collector(t, r.endpoint)
  await c.hook('UserPromptSubmit')
  const stop = await c.hook('Stop')
  assert.equal(stop.status, 0)
  assert.equal(stop.stdout.trim(), '{}')
  for (let i = 0; i < 100 && c.status().queued; i++) await sleep(100)
  assert.deepEqual(c.status(), { queued: 0, rejected: 0, lost: 0 })
  assert.equal(r.received.length, 2)
})

test('an unreachable server never fails the hook or counts as loss', async (t) => {
  const c = collector(t, 'http://127.0.0.1:9/api/agent-tracking/events')
  await c.hook('UserPromptSubmit')
  const stop = await c.hook('Stop', { CI: 'true' })
  assert.equal(stop.status, 0)
  assert.equal(stop.stdout.trim(), '{}')
  assert.equal(c.status().lost, 0)
  assert.equal(c.status().queued, 2)
})

test('drain waits out the backoff a failed request caused, within its wait budget', async (t) => {
  const r = await receiver(t, 1)
  const q = queued(t, r.endpoint)
  const started = Date.now()
  assert.equal(
    await drain(q.queue, q.config, { waitUntil: Date.now() + 10_000 }),
    'drained',
  )
  assert.equal(r.calls(), 2)
  assert.ok(Date.now() - started >= 900, 'slept through the 1 s backoff')
  assert.deepEqual(q.queue.status(), { queued: 0, rejected: 0, lost: 0 })
})

test('drain without a wait budget reports the retry instead of giving up silently', async (t) => {
  const r = await receiver(t, 1)
  const q = queued(t, r.endpoint)
  assert.equal(await drain(q.queue, q.config), 'retry')
  assert.equal(r.calls(), 1)
  assert.equal(q.queue.status().queued, 1)
  // Already in backoff from another process: nothing is due, but it is not drained.
  assert.equal(await drain(q.queue, q.config), 'waiting')
  assert.equal(r.calls(), 1)
})

test('drain never starts a request it cannot finish inside its deadline', async (t) => {
  const r = await receiver(t)
  const q = queued(t, r.endpoint)
  assert.equal(
    await drain(q.queue, q.config, { deadline: Date.now() + 500 }),
    'incomplete',
  )
  assert.equal(r.calls(), 0)
  // The event stays due for the next uploader rather than in backoff.
  assert.ok(q.queue.nextAttemptAt() <= Date.now())
})

test('a CI Stop hook survives one failed request and still delivers before it returns', async (t) => {
  const r = await receiver(t, 1)
  const c = collector(t, r.endpoint)
  await c.hook('UserPromptSubmit')
  const stop = await c.hook('Stop', { CI: 'true' })
  assert.equal(stop.status, 0)
  assert.equal(stop.stdout.trim(), '{}')
  // Jitter can split the two backed-off events across requests.
  assert.ok(r.calls() >= 2)
  assert.deepEqual(r.received.map((e) => e.eventType).sort(), [
    'run.observed',
    'run.started',
  ])
  assert.deepEqual(c.status(), { queued: 0, rejected: 0, lost: 0 })
})

test('the detached uploader waits out backoff left by an earlier process', async (t) => {
  const r = await receiver(t)
  const q = queued(t, r.endpoint)
  q.queue.retry([q.event])
  assert.ok(q.queue.nextAttemptAt() > Date.now())
  const child = spawn(process.execPath, [resolve('dist/cli.js'), 'sync'], {
    env: {
      ...process.env,
      NODE_NO_WARNINGS: '1',
      WORK_ADDRESS_STATE_DIR: q.dir,
      WORK_ADDRESS_SYNC_WAIT_MS: '10000',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let stdout = ''
  child.stdout.on('data', (d) => (stdout += d))
  const [code] = await once(child, 'close')
  assert.equal(code, 0, stdout)
  assert.deepEqual(JSON.parse(stdout), { queued: 0, rejected: 0, lost: 0 })
  assert.equal(r.received.length, 1)
})
