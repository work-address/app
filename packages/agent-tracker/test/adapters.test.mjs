import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import {
  EventQueue,
  captureHook,
  CodexExecAdapter,
  serverAdapters,
  setup,
  readConfig,
  emitEvent,
} from '../dist/index.js'

function context(t) {
  const dir = mkdtempSync(join(tmpdir(), 'wa-adapters-'))
  setup(
    dir,
    'http://127.0.0.1:4199/events',
    randomUUID(),
    'test-only-credential-0000',
  )
  const config = readConfig(dir)
  let queue = new EventQueue(dir, config)
  t.after(() => {
    queue.close()
    rmSync(dir, { recursive: true, force: true })
  })
  const options = {
    runtimeVersion: 'fixture-2026-10-17',
    now: () => Date.parse('2026-10-17T12:00:00Z'),
  }
  return {
    dir,
    config,
    options,
    get queue() {
      return queue
    },
    capture(product, name, extra = {}) {
      return captureHook(
        queue,
        config,
        product,
        { session_id: 's', hook_event_name: name, ...extra },
        options,
      )
    },
    reopen() {
      queue.close()
      queue = new EventQueue(dir, config)
    },
  }
}
const hermes = { turn_id: 't', telemetry_schema_version: 'hermes.observer.v1' }

test('Hermes root turns survive restart, retain no content, and deduplicate repeated callbacks', (t) => {
  const c = context(t)
  c.capture('hermes', 'pre_llm_call', {
    ...hermes,
    user_message: 'PRIVATE',
    conversation_history: ['PRIVATE'],
    model: 'PRIVATE',
  })
  c.reopen()
  c.capture('hermes', 'pre_llm_call', hermes)
  c.capture('hermes', 'on_session_end', {
    ...hermes,
    completed: true,
    failed: false,
    interrupted: false,
  })
  c.capture('hermes', 'on_session_end', { ...hermes, completed: true })
  const events = c.queue.batch()
  assert.deepEqual(
    events.map((e) => e.eventType),
    ['run.started', 'run.completed'],
  )
  assert.equal(events[0].runId, events[1].runId)
  assert.equal(events[0].source.epoch, events[1].source.epoch)
  assert.equal(events[0].clock.basis, 'collector_wall')
  assert.equal(JSON.stringify(events).includes('PRIVATE'), false)
  assert.equal(
    readFileSync(join(c.dir, 'queue.sqlite')).includes(Buffer.from('PRIVATE')),
    false,
  )
})
test('Hermes failures, interruptions, ambiguous end and legacy shutdown are distinct', (t) => {
  const c = context(t)
  for (const [i, flags] of [
    { failed: true },
    { interrupted: true },
    {},
    { failed: true, completed: true },
  ].entries()) {
    const data = { ...hermes, turn_id: String(i) }
    c.capture('hermes', 'pre_llm_call', data)
    c.capture('hermes', 'on_session_end', { ...data, ...flags })
  }
  assert.equal(
    c.capture('hermes', 'on_session_end', {
      telemetry_schema_version: 'hermes.observer.v1',
    }),
    0,
  )
  assert.deepEqual(
    c.queue
      .batch()
      .filter((e) => e.eventType !== 'run.started')
      .map((e) => e.eventType),
    ['run.failed', 'run.cancelled', 'run.observed', 'run.observed'],
  )
  assert.throws(() =>
    c.capture('hermes', 'pre_llm_call', {
      ...hermes,
      telemetry_schema_version: 'v2',
    }),
  )
})
test('Hermes children are suppressed, late terminals stay tied to their own turn', (t) => {
  const c = context(t)
  c.capture('hermes', 'pre_llm_call', {
    ...hermes,
    parent_session_id: 'parent',
  })
  c.reopen()
  c.capture('hermes', 'on_session_end', { ...hermes, completed: true })
  assert.equal(c.queue.batch().length, 0)
  c.capture('hermes', 'on_session_end', {
    ...hermes,
    turn_id: 'other',
    failed: true,
  })
  c.capture('hermes', 'pre_llm_call', { ...hermes, turn_id: 'other' })
  assert.deepEqual(
    c.queue.batch().map((e) => e.eventType),
    ['run.failed', 'run.started'],
  )
})
for (const product of ['claude-code', 'codex', 'kimi-code'])
  test(`${product}: Stop is never a successful terminal`, (t) => {
    const c = context(t),
      data = { turn_id: 't' }
    c.capture(
      product,
      product === 'kimi-code' ? 'TurnStarted' : 'UserPromptSubmit',
      data,
    )
    c.capture(product, 'Stop', {
      ...data,
      stop_hook_active: false,
      last_assistant_message: 'PRIVATE',
    })
    c.capture(product, 'Stop', { ...data, stop_hook_active: true })
    c.capture(product, 'PostToolUseFailure', data)
    assert.deepEqual(
      c.queue.batch().map((e) => e.eventType),
      ['run.started', 'run.observed', 'run.observed'],
    )
    c.capture(
      product,
      product === 'claude-code' ? 'StopFailure' : 'Interrupt',
      data,
    )
    assert.equal(
      c.queue.batch().at(-1).eventType,
      product === 'claude-code' ? 'run.failed' : 'run.cancelled',
    )
  })
test('Kimi scheduled starts and late turn terminals do not close a different run', (t) => {
  const c = context(t)
  c.capture('kimi-code', 'UserPromptSubmit', { prompt: 'PRIVATE' })
  c.capture('kimi-code', 'TurnStarted', {
    turn_id: 't1',
    origin_kind: 'system_trigger',
  })
  c.capture('kimi-code', 'TurnStarted', { turn_id: 't2' })
  c.capture('kimi-code', 'StopFailure', { turn_id: 't1' })
  assert.deepEqual(
    c.queue.batch().map((e) => e.eventType),
    ['run.started', 'run.started'],
  )
})
test('OpenCode records session observations, never qualified run boundaries', (t) => {
  const c = context(t)
  c.capture('opencode', 'busy')
  c.capture('opencode', 'busy')
  c.capture('opencode', 'idle')
  assert.deepEqual(
    c.queue.batch().map((e) => e.observedState),
    ['running', 'unknown'],
  )
  assert.ok(
    c.queue
      .batch()
      .every(
        (e) => !e.capabilities.runBoundaries && e.eventType === 'run.observed',
      ),
  )
})
test('Codex exec ignores item/errors, separates sequential turns and marks disconnect unknown', (t) => {
  const c = context(t),
    a = new CodexExecAdapter(c.config, randomUUID(), c.options)
  assert.equal(a.normalize({ type: 'turn.started' }), undefined)
  a.normalize({ type: 'thread.started', thread_id: 'thread' })
  const first = a.normalize({ type: 'turn.started' })
  assert.equal(a.normalize({ type: 'error', message: 'PRIVATE' }), undefined)
  const end = a.normalize({
    type: 'turn.completed',
    usage: { secret: 'PRIVATE' },
  })
  const second = a.normalize({ type: 'turn.started' })
  assert.equal(first.runId, end.runId)
  assert.notEqual(first.runId, second.runId)
  assert.equal(a.disconnected().observedState, 'unknown')
  assert.equal(a.disconnected(), undefined)
})
test('all documented server routes have explicit status; unsupported ones are not advertised as working', () => {
  for (const name of [
    'openclaw',
    'hermes',
    'claude-code',
    'cowork',
    'codex',
    'kimi-code',
    'kimi-server',
    'kimi-legacy',
    'opencode',
    'generic',
    'otel',
  ])
    assert.ok(serverAdapters[name].limitation)
  assert.equal(serverAdapters.cowork.status, 'unavailable')
  assert.equal(serverAdapters['kimi-server'].status, 'unavailable')
})
test('capture state and queue writes roll back together if event validation fails', (t) => {
  const c = context(t)
  assert.throws(() =>
    captureHook(
      c.queue,
      c.config,
      'hermes',
      {
        session_id: 's',
        hook_event_name: 'pre_llm_call',
        ...hermes,
      },
      { runtimeVersion: 'invalid version' },
    ),
  )
  c.capture('hermes', 'pre_llm_call', hermes)
  assert.equal(c.queue.batch().length, 1)
  assert.throws(() =>
    emitEvent(c.queue, { ...c.queue.batch()[0], prompt: 'PRIVATE' }),
  )
})
test('command hook fails open, bounds stdin and requires explicit experimental opt-in', (t) => {
  const c = context(t)
  const run = (input, enabled = true) =>
    spawnSync(process.execPath, [resolve('dist/cli.js'), 'hook', 'hermes'], {
      input,
      encoding: 'utf8',
      env: {
        ...process.env,
        NODE_NO_WARNINGS: '1',
        WORK_ADDRESS_STATE_DIR: c.dir,
        WORK_ADDRESS_EXPERIMENTAL_ADAPTERS: enabled ? '1' : '0',
      },
      timeout: 3000,
    })
  const input = JSON.stringify({
    session_id: 's',
    hook_event_name: 'pre_llm_call',
    ...hermes,
  })
  assert.equal(run(input, false).status, 0)
  assert.equal(c.queue.batch().length, 0)
  const good = run(input)
  assert.equal(good.status, 0)
  assert.equal(good.stdout.trim(), '{}')
  assert.equal(good.stderr, '')
  const bad = run('PRIVATE'.repeat(200000))
  assert.equal(bad.status, 0)
  assert.equal(bad.stdout.trim(), '{}')
  assert.equal(bad.stderr.includes('PRIVATE'), false)
  assert.ok(c.queue.status().lost > 0)
})

test('Claude submissions after an unobserved interruption never inherit the earlier run', (t) => {
  const c = context(t)
  c.capture('claude-code', 'UserPromptSubmit')
  const first = c.queue.batch()[0]
  c.reopen()
  // Claude sends no Stop on interruption. No content or heuristic can identify it.
  c.capture('claude-code', 'UserPromptSubmit')
  c.capture('claude-code', 'StopFailure')
  const events = c.queue.batch()
  assert.deepEqual(
    events.map((e) => e.eventType),
    ['run.started', 'run.observed', 'run.started', 'run.failed'],
  )
  assert.equal(events[1].runId, first.runId)
  assert.equal(events[1].observedState, 'unknown')
  assert.notEqual(events[2].runId, first.runId)
  assert.equal(events[3].runId, events[2].runId)
  assert.ok(events.every((e) => !e.capabilities.runBoundaries))
})

test('Codex source sequence increases across successful, failed and disconnected turns', (t) => {
  const c = context(t),
    adapter = new CodexExecAdapter(c.config, randomUUID(), c.options)
  adapter.normalize({ type: 'thread.started', thread_id: 'thread' })
  const events = [
    'turn.started',
    'turn.completed',
    'turn.started',
    'turn.failed',
    'turn.started',
  ].map((type) => adapter.normalize({ type }))
  events.push(adapter.disconnected())
  assert.deepEqual(
    events.map((e) => e.source.sequence),
    [0, 1, 2, 3, 4, 5],
  )
  assert.equal(new Set(events.map((e) => e.source.epoch)).size, 1)
  assert.equal(new Set(events.map((e) => e.runId)).size, 3)
})
