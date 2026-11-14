import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import {
  EventQueue,
  captureHook,
  kimiOpenTurns,
  readConfig,
  reconcileKimi,
  setup,
} from '../dist/index.js'

// As Kimi Code 2.6.2 writes them (fields trimmed).
const ended = (turnId, reason, time) =>
  JSON.stringify({
    type: 'turn.ended',
    agentId: 'main',
    turnId,
    reason,
    durationMs: 1052,
    time,
  })

function context(t) {
  const dir = mkdtempSync(join(tmpdir(), 'wa-kimi-'))
  setup(
    dir,
    'http://127.0.0.1:4199/events',
    randomUUID(),
    'test-credential-0000',
  )
  const config = readConfig(dir)
  const queue = new EventQueue(dir, config)
  const home = join(dir, 'kimi')
  t.after(() => {
    queue.close()
    rmSync(dir, { recursive: true, force: true })
  })
  const options = { runtimeVersion: '2.6.2' }
  const wire = (session, lines) => {
    const at = join(home, 'sessions', 'wd_work_abc', session, 'agents', 'main')
    mkdirSync(at, { recursive: true })
    writeFileSync(join(at, 'wire.jsonl'), lines.join('\n') + '\n')
  }
  const start = (session, turn_id, origin_kind = 'user') =>
    captureHook(
      queue,
      config,
      'kimi-code',
      {
        session_id: session,
        hook_event_name: 'TurnStarted',
        turn_id,
        origin_kind,
        prompt: 'x',
      },
      options,
    )
  const reconcile = () => reconcileKimi(queue, config, options, home)
  return { queue, config, wire, start, reconcile }
}

test('a Kimi turn with no Stop is closed by its turn.ended', (t) => {
  const c = context(t)
  c.start('session_a', 0)
  c.start('session_b', 0)
  assert.equal(c.reconcile(), 0) // Still running: nothing in the store yet.
  c.wire('session_a', [
    ended(0, 'completed', Date.parse('2026-11-14T19:35:19.543Z')),
  ])
  c.wire('session_b', [ended(0, 'failed', Date.parse('2026-11-14T19:35:20Z'))])
  assert.equal(c.reconcile(), 2)
  const events = c.queue.batch()
  assert.deepEqual(
    events.map((e) => e.eventType),
    ['run.started', 'run.started', 'run.completed', 'run.failed'],
  )
  assert.equal(events[2].occurredAt, '2026-11-14T19:35:19.543Z')
  assert.equal(kimiOpenTurns(c.queue).length, 0)
  assert.equal(c.reconcile(), 0)
})

test('a turn the hooks already ended, or a later turn, is left alone', (t) => {
  const c = context(t)
  c.start('session_a', 0)
  captureHook(
    c.queue,
    c.config,
    'kimi-code',
    { session_id: 'session_a', hook_event_name: 'Interrupt', turn_id: 0 },
    { runtimeVersion: '2.6.2' },
  )
  c.start('session_a', 1)
  c.wire('session_a', [
    ended(0, 'cancelled', Date.now()),
    '{"type":"turn.ended","turnId":1,', // Torn line while Kimi writes.
  ])
  assert.equal(c.reconcile(), 0)
  assert.equal(kimiOpenTurns(c.queue).length, 1)
})

test('system-triggered turns are never listed', (t) => {
  const c = context(t)
  c.start('session_a', 0, 'system_trigger')
  assert.equal(kimiOpenTurns(c.queue).length, 0)
})
