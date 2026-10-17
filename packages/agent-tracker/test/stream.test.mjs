import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { randomUUID } from 'node:crypto'
import { collectCodexStream } from '../dist/stream.js'
import { setup, EventQueue } from '../dist/index.js'

for (const reason of [
  'initialize',
  'storage',
  'capacity',
  'malformed',
  'oversized',
])
  test(`stream drains to EOF after ${reason} failure without leaking payloads`, async () => {
    let reads = 0,
      normalized = 0,
      warnings = 0,
      closed = false
    async function* input() {
      const head =
        reason === 'malformed'
          ? 'PRIVATE\n'
          : reason === 'oversized'
            ? 'x'.repeat(1024 * 1024 + 1)
            : '{}\n'
      // Split across many reads to exercise the byte limit and drain mode.
      for (let i = 0; i < head.length; i += 1024) {
        reads++
        yield Buffer.from(head.slice(i, i + 1024))
      }
      for (let i = 0; i < 10; i++) {
        reads++
        yield Buffer.from('{}\n')
      }
    }
    const ok = await collectCodexStream(
      input(),
      () => {
        if (reason === 'initialize') throw Error('PRIVATE')
        return {
          adapter: {
            normalize() {
              normalized++
              return {}
            },
            disconnected() {
              return undefined
            },
          },
          queue: {
            enqueue() {
              if (reason === 'storage') throw Error('PRIVATE')
              return reason !== 'capacity'
            },
            recordLoss() {
              throw Error('PRIVATE')
            },
            close() {
              closed = true
            },
          },
        }
      },
      () => {
        warnings++
        throw Error('logger unavailable')
      },
    )
    assert.equal(ok, false)
    assert.equal(warnings, 1)
    assert.equal(reads, (reason === 'oversized' ? 1025 : 1) + 10)
    assert.ok(normalized <= 1)
    assert.equal(closed, reason !== 'initialize')
  })

function context(t) {
  const dir = mkdtempSync(join(tmpdir(), 'wa-stream-'))
  const config = setup(
    dir,
    'http://127.0.0.1:4199/events',
    randomUUID(),
    'test-credential-00000',
  )
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  return { dir, config }
}
function launch(t, directory) {
  const child = spawn(
    process.execPath,
    [
      fileURLToPath(new URL('../dist/cli.js', import.meta.url)),
      'stream',
      'codex',
    ],
    {
      env: {
        ...process.env,
        NODE_NO_WARNINGS: '1',
        WORK_ADDRESS_STATE_DIR: directory,
        WORK_ADDRESS_EXPERIMENTAL_ADAPTERS: '1',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    },
  )
  t.after(() => {
    if (child.exitCode === null) child.kill()
  })
  return child
}
for (const failure of ['oversized', 'missing-config'])
  test(
    `CLI preserves the producer pipe after ${failure} until the producer closes it`,
    { timeout: 5000 },
    async (t) => {
      const c = context(t),
        child = launch(
          t,
          failure === 'missing-config' ? join(c.dir, 'absent') : c.dir,
        )
      const warned = once(child.stderr, 'data')
      const exited = once(child, 'exit')
      let pipeError
      child.stdin.on('error', (error) => {
        pipeError = error
      })
      if (failure === 'oversized')
        child.stdin.write('x'.repeat(1024 * 1024 + 1))
      await warned
      assert.equal(child.exitCode, null)
      // Actual OS pipe write after the collector has reported its failure.
      await new Promise((resolve, reject) =>
        child.stdin.write('\n{}\n', (error) =>
          error ? reject(error) : resolve(),
        ),
      )
      child.stdin.end()
      const [code] = await exited
      assert.equal(code, 1)
      assert.equal(pipeError, undefined)
    },
  )

test(
  'CLI accepts a healthy live stream, including final line without newline',
  { timeout: 5000 },
  async (t) => {
    const c = context(t),
      child = launch(t, c.dir),
      exited = once(child, 'exit')
    child.stdin.end(
      [
        { type: 'thread.started', thread_id: 't' },
        { type: 'turn.started' },
        { type: 'item.completed', item: { text: 'PRIVATE' } },
        { type: 'turn.completed' },
      ]
        .map(JSON.stringify)
        .join('\n'),
    )
    assert.equal((await exited)[0], 0)
    const queue = new EventQueue(c.dir, c.config)
    try {
      assert.deepEqual(
        queue.batch().map((e) => e.eventType),
        ['run.started', 'run.completed'],
      )
      assert.equal(JSON.stringify(queue.batch()).includes('PRIVATE'), false)
    } finally {
      queue.close()
    }
  },
)

for (const ending of ['truncated', 'malformed'])
  test(
    `CLI keeps an active run unknown on ${ending} input`,
    { timeout: 5000 },
    async (t) => {
      const c = context(t),
        child = launch(t, c.dir),
        exited = once(child, 'exit')
      child.stderr.resume()
      const lines = [
        { type: 'thread.started', thread_id: 't' },
        { type: 'turn.started' },
      ].map(JSON.stringify)
      if (ending === 'malformed')
        lines.push(
          'PRIVATE malformed',
          JSON.stringify({ type: 'turn.completed' }),
        )
      child.stdin.end(lines.join('\n') + '\n')
      assert.equal((await exited)[0], 1)
      const queue = new EventQueue(c.dir, c.config)
      try {
        const events = queue.batch()
        assert.deepEqual(
          events.map((e) => e.eventType),
          ['run.started', 'run.observed'],
        )
        assert.equal(events[1].observedState, 'unknown')
        assert.equal(events[0].runId, events[1].runId)
        assert.equal(JSON.stringify(events).includes('PRIVATE'), false)
        assert.ok(queue.status().lost > 0)
      } finally {
        queue.close()
      }
    },
  )
