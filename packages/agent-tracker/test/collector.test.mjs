import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, statSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import {
  EventQueue,
  setup,
  readConfig,
  sync,
  validateConfig,
} from '../dist/index.js'
import { fixture } from './fixture.mjs'

function context(t, options = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'wa-collector-'))
  const config = {
    endpoint: 'http://127.0.0.1:4199/api/agent-tracking/events',
    projectId: fixture.projectId,
    instanceId: fixture.source.instanceId,
    credential: 'test-only-credential-0000',
  }
  let queue = new EventQueue(directory, config, options)
  t.after(() => {
    queue.close()
    rmSync(directory, { recursive: true, force: true })
  })
  return {
    directory,
    config,
    get queue() {
      return queue
    },
    reopen() {
      queue.close()
      queue = new EventQueue(directory, config, options)
    },
  }
}
function accepted(events, status = 'accepted') {
  return Response.json({
    results: events.map((e) => ({ eventId: e.eventId, status })),
  })
}

test('queue survives restart and deduplicates retry observations', (t) => {
  const c = context(t)
  c.queue.enqueue(fixture)
  c.queue.enqueue({ ...fixture, observedAt: '2026-10-17T10:00:02.000Z' })
  c.reopen()
  assert.deepEqual(c.queue.batch(), [fixture])
  assert.throws(
    () => c.queue.enqueue({ ...fixture, eventType: 'run.failed' }),
    /EVENT_ID_CONFLICT/,
  )
})
test('queue refuses destination/credential changes and mismatched events', (t) => {
  const c = context(t)
  assert.throws(
    () =>
      new EventQueue(c.directory, {
        ...c.config,
        endpoint: 'https://other.example/events',
      }),
    /SCOPE/,
  )
  assert.throws(
    () => c.queue.enqueue({ ...fixture, projectId: randomUUID() }),
    /SCOPE/,
  )
})
test('two connections cannot acquire the upload lease; crashed lease expires', (t) => {
  let now = 1
  const c = context(t, { now: () => now })
  const second = new EventQueue(c.directory, c.config, { now: () => now })
  try {
    const owner = c.queue.acquire()
    assert.ok(owner)
    assert.equal(second.acquire(), undefined)
    now += 30_001
    assert.ok(second.acquire())
    c.queue.release(owner) // Old owner cannot release its replacement.
    assert.equal(c.queue.acquire(), undefined)
  } finally {
    second.close()
  }
})
test('capacity and retention loss is visible', (t) => {
  let now = 0
  const c = context(t, {
    maxBytes: Buffer.byteLength(JSON.stringify(fixture)),
    now: () => now,
    retentionMs: 10,
  })
  assert.equal(c.queue.enqueue(fixture), true)
  assert.equal(c.queue.enqueue({ ...fixture, eventId: randomUUID() }), false)
  now = 11
  assert.equal(c.queue.batch().length, 0)
  assert.equal(c.queue.status().lost, 2)
})
test('upload acknowledges only explicitly accepted or duplicate events', async (t) => {
  const c = context(t)
  c.queue.enqueue(fixture)
  let calls = 0
  const fetcher = async (url, init) => {
    calls++
    assert.equal(url, c.config.endpoint)
    assert.equal(init.redirect, 'error')
    assert.equal(init.headers.Authorization, `Bearer ${c.config.credential}`)
    return accepted(JSON.parse(init.body).events, 'duplicate')
  }
  assert.equal((await sync(c.queue, c.config, fetcher)).sent, 1)
  assert.equal(c.queue.status().queued, 0)
  assert.equal(calls, 1)
})
test('transport failure preserves IDs and retries with backoff', async (t) => {
  let now = 0
  const c = context(t, { now: () => now })
  c.queue.enqueue(fixture)
  assert.equal(
    (
      await sync(c.queue, c.config, async () => {
        throw new Error('private network error')
      })
    ).state,
    'retry',
  )
  assert.equal(c.queue.batch().length, 0)
  now = 2001
  assert.equal(c.queue.batch()[0].eventId, fixture.eventId)
  await sync(c.queue, c.config, async (_, init) =>
    accepted(JSON.parse(init.body).events),
  )
  assert.equal(c.queue.status().queued, 0)
})
test('partial acknowledgement leaves missing events queued and holds rejections', async (t) => {
  const c = context(t)
  c.queue.enqueue(fixture)
  c.queue.enqueue({ ...fixture, eventId: randomUUID() })
  await sync(c.queue, c.config, async () =>
    Response.json({
      results: [
        {
          eventId: fixture.eventId,
          status: 'rejected',
          code: 'AGENT_NOT_ATTACHED',
        },
      ],
    }),
  )
  assert.deepEqual(c.queue.status(), { queued: 1, rejected: 1, lost: 0 })
})
test('foreign, repeated, malformed and oversized acknowledgements do not delete data', async (t) => {
  const c = context(t)
  c.queue.enqueue(fixture)
  for (const response of [
    Response.json({ results: [{ eventId: randomUUID(), status: 'accepted' }] }),
    Response.json({
      results: [
        { eventId: fixture.eventId, status: 'accepted' },
        { eventId: fixture.eventId, status: 'accepted' },
      ],
    }),
    new Response('x'.repeat(70_000)),
    new Response('not json'),
  ]) {
    // A fresh queue clock allows each explicitly forced retry.
    c.queue.retry = () => {}
    assert.equal(
      (await sync(c.queue, c.config, async () => response)).state,
      'retry',
    )
    assert.equal(c.queue.status().queued, 1)
  }
})
test('setup stores private credentials and never overwrites identity', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'wa-setup-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const config = setup(
    directory,
    'https://example.test/api/agent-tracking/events',
    fixture.projectId,
    'a-private-test-credential',
  )
  assert.deepEqual(readConfig(directory), config)
  if (process.platform !== 'win32')
    assert.equal(statSync(join(directory, 'config.json')).mode & 0o777, 0o600)
  assert.throws(() =>
    setup(
      directory,
      config.endpoint,
      fixture.projectId,
      'another-test-credential',
    ),
  )
  assert.ok(
    readFileSync(join(directory, 'config.json'), 'utf8').includes(
      config.instanceId,
    ),
  )
})
test('transport only permits HTTPS or explicit loopback HTTP', () => {
  const config = {
    endpoint: 'http://remote.test/events',
    projectId: fixture.projectId,
    instanceId: fixture.source.instanceId,
    credential: 'test-credential-000000',
  }
  for (const endpoint of [
    'http://remote.test/events',
    'https://user:password@example.test/events',
    'https://example.test/events?secret=value',
  ])
    assert.throws(() => validateConfig({ ...config, endpoint }))
})

test('sync cannot redirect an existing queue through an alternate config', async (t) => {
  const c = context(t)
  c.queue.enqueue(fixture)
  let called = false
  await assert.rejects(
    sync(
      c.queue,
      { ...c.config, endpoint: 'https://other.example/events' },
      async () => {
        called = true
        return accepted([])
      },
    ),
    /SCOPE/,
  )
  assert.equal(called, false)
  assert.equal(c.queue.status().queued, 1)
})

for (const status of [400, 401, 403, 404, 413])
  test(`HTTP ${status} is retained as rejected and never automatically retried`, async (t) => {
    let now = 0
    const c = context(t, { now: () => now })
    c.queue.enqueue(fixture)
    let calls = 0
    const fetcher = async () => {
      calls++
      return new Response('PRIVATE error details', { status })
    }
    assert.deepEqual(await sync(c.queue, c.config, fetcher), {
      state: 'rejected',
      sent: 0,
    })
    c.reopen()
    now = 3600_000
    assert.equal((await sync(c.queue, c.config, fetcher)).state, 'idle')
    assert.equal(calls, 1)
    assert.deepEqual(c.queue.status(), { queued: 0, rejected: 1, lost: 0 })
    assert.equal(
      readFileSync(join(c.directory, 'queue.sqlite')).includes(
        Buffer.from('PRIVATE'),
      ),
      false,
    )
    now = 8 * 86400_000
    c.queue.batch()
    assert.deepEqual(c.queue.status(), { queued: 0, rejected: 0, lost: 1 })
  })

for (const status of [429, 503])
  for (const format of ['seconds', 'date'])
    test(`HTTP ${status} ${format} Retry-After survives restart and defers new events`, async (t) => {
      let now = Date.parse('2026-10-18T12:00:00Z')
      const deadline = now + 120_000
      const c = context(t, { now: () => now })
      c.queue.enqueue(fixture)
      const result = await sync(
        c.queue,
        c.config,
        async () =>
          new Response('PRIVATE', {
            status,
            headers: {
              'Retry-After':
                format === 'seconds' ? '120' : new Date(deadline).toUTCString(),
            },
          }),
      )
      assert.equal(result.state, 'retry')
      c.reopen()
      c.queue.enqueue({ ...fixture, eventId: randomUUID() })
      now += 2001
      let calls = 0
      const fetcher = async (_, init) => {
        calls++
        return accepted(JSON.parse(init.body).events)
      }
      assert.equal((await sync(c.queue, c.config, fetcher)).state, 'idle')
      now = deadline - 1
      assert.equal(c.queue.batch().length, 0)
      assert.equal(calls, 0)
      now = deadline
      assert.equal((await sync(c.queue, c.config, fetcher)).sent, 2)
      assert.equal(c.queue.status().queued, 0)
    })

for (const header of [
  null,
  'nonsense',
  '-1',
  '1.5',
  '99999999999999999999999',
  'Sun, 18 Oct 2026 11:00:00 GMT',
])
  test(`invalid or expired Retry-After ${header} falls back to backoff`, async (t) => {
    let now = Date.parse('2026-10-18T12:00:00Z')
    const c = context(t, { now: () => now, random: () => 0.5 })
    c.queue.enqueue(fixture)
    await sync(
      c.queue,
      c.config,
      async () =>
        new Response('{}', {
          status: 429,
          headers: header === null ? {} : { 'Retry-After': header },
        }),
    )
    now += 1499
    assert.equal(c.queue.batch().length, 0)
    now++
    assert.equal(c.queue.batch()[0].eventId, fixture.eventId)
  })

for (const status of [408, 500, 502, 504])
  test(`HTTP ${status} remains retryable`, async (t) => {
    let now = 0
    const c = context(t, { now: () => now })
    c.queue.enqueue(fixture)
    assert.equal(
      (
        await sync(
          c.queue,
          c.config,
          async () => new Response('{}', { status }),
        )
      ).state,
      'retry',
    )
    now = 2001
    assert.deepEqual(c.queue.batch(), [fixture])
    assert.equal(c.queue.status().rejected, 0)
  })

test('jitter varies retry deadlines while keeping exponential growth and the one-hour ceiling', (t) => {
  let now = 0,
    random = 0
  const c = context(t, { now: () => now, random: () => random })
  c.queue.enqueue(fixture)
  c.queue.retry([fixture])
  now = 999
  assert.equal(c.queue.batch().length, 0)
  now = 1000
  assert.equal(c.queue.batch().length, 1)
  random = 0.5
  c.queue.retry([fixture])
  now = 3999
  assert.equal(c.queue.batch().length, 0)
  now = 4000
  assert.equal(c.queue.batch().length, 1)
  for (let i = 0; i < 20; i++) c.queue.retry([fixture])
  now += 2700_000 - 1
  assert.equal(c.queue.batch().length, 0)
  now++
  assert.equal(c.queue.batch().length, 1)
})

test('queue scope ignores config key order and equivalent endpoint spelling', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'wa-scope-'))
  const config = {
    credential: 'test-only-credential-0000',
    instanceId: fixture.source.instanceId,
    projectId: fixture.projectId,
    endpoint: 'https://EXAMPLE.test:443',
  }
  let queue = new EventQueue(directory, config)
  t.after(() => {
    queue.close()
    rmSync(directory, { recursive: true, force: true })
  })
  queue.enqueue(fixture)
  queue.assertScope(validateConfig(config))
  assert.equal(
    (
      await sync(queue, config, async (url, init) => {
        assert.equal(url, 'https://example.test/')
        return accepted(JSON.parse(init.body).events)
      })
    ).sent,
    1,
  )
  queue.close()
  queue = new EventQueue(directory, validateConfig(config))
  queue.assertScope(config)
  for (const change of [
    { credential: 'another-test-credential' },
    { endpoint: 'https://other.example/' },
    { projectId: randomUUID() },
    { instanceId: randomUUID() },
  ])
    assert.throws(() => queue.assertScope({ ...config, ...change }), /SCOPE/)
})

test('legacy noncanonical queue scope upgrades without losing events or relaxing isolation', async (t) => {
  const c = context(t)
  c.queue.enqueue(fixture)
  const original = {
    credential: c.config.credential,
    instanceId: c.config.instanceId,
    projectId: c.config.projectId,
    endpoint: c.config.endpoint,
  }
  const db = new DatabaseSync(join(c.directory, 'queue.sqlite'))
  try {
    db.prepare("UPDATE metadata SET value=? WHERE key='scope'").run(
      createHash('sha256').update(JSON.stringify(original)).digest('hex'),
    )
  } finally {
    db.close()
  }
  assert.throws(
    () =>
      new EventQueue(c.directory, {
        ...original,
        credential: 'another-test-credential',
      }),
    /SCOPE/,
  )
  const recovered = new EventQueue(c.directory, original)
  try {
    assert.equal(
      (
        await sync(recovered, c.config, async (_, init) =>
          accepted(JSON.parse(init.body).events),
        )
      ).sent,
      1,
    )
  } finally {
    recovered.close()
  }
  c.reopen()
  assert.equal(c.queue.status().queued, 0)
})
