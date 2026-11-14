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
  promptText,
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

test('Hermes root turns survive restart, keep only the prompt, and deduplicate repeated callbacks', (t) => {
  const c = context(t)
  c.capture('hermes', 'pre_llm_call', {
    ...hermes,
    user_message: 'Fix the build',
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
  assert.equal(events[0].prompt, 'Fix the build')
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
test('Kimi late turn terminals do not close a different run', (t) => {
  const c = context(t)
  c.capture('kimi-code', 'UserPromptSubmit', { prompt: 'PRIVATE' })
  c.capture('kimi-code', 'TurnStarted', { turn_id: 't1', origin_kind: 'task' })
  c.capture('kimi-code', 'TurnStarted', { turn_id: 't2' })
  c.capture('kimi-code', 'StopFailure', { turn_id: 't1' })
  assert.deepEqual(
    c.queue.batch().map((e) => e.eventType),
    ['run.started', 'run.started'],
  )
})
test('Kimi system-triggered turns are left out, with their Stop', (t) => {
  const c = context(t)
  c.capture('kimi-code', 'TurnStarted', {
    turn_id: 't1',
    origin_kind: 'system_trigger',
    prompt: 'PRIVATE',
  })
  c.capture('kimi-code', 'Stop', { turn_id: 't1' })
  c.capture('kimi-code', 'TurnStarted', {
    turn_id: 't2',
    origin_kind: 'user',
    prompt: '  Fix the build\n',
  })
  c.capture('kimi-code', 'Stop', {})
  c.capture('kimi-code', 'TurnStarted', {
    turn_id: 't3',
    origin_kind: 'scheduled',
  })
  c.capture('kimi-code', 'Interrupt', { reason: 'esc' })
  const events = c.queue.batch()
  assert.deepEqual(
    events.map((e) => e.eventType),
    ['run.started', 'run.observed'],
  )
  assert.equal(events[0].prompt, 'Fix the build')
  assert.equal(JSON.stringify(events).includes('PRIVATE'), false)
})
test('Kimi task turns are recorded without a prompt', (t) => {
  const c = context(t)
  c.capture('kimi-code', 'TurnStarted', {
    turn_id: 't1',
    origin_kind: 'task',
    prompt: 'Background task',
  })
  const [start] = c.queue.batch()
  assert.equal(start.eventType, 'run.started')
  assert.equal('prompt' in start, false)
})
for (const product of ['claude-code', 'codex'])
  test(`${product}: the run start carries the submitted prompt`, (t) => {
    const c = context(t)
    c.capture(product, 'UserPromptSubmit', {
      turn_id: 't',
      prompt: '  Fix the login bug\n',
    })
    c.capture(product, 'Stop', { turn_id: 't', last_assistant_message: 'X' })
    const [start, stop] = c.queue.batch()
    assert.equal(start.prompt, 'Fix the login bug')
    assert.equal('prompt' in stop, false)
  })
test('prompts stay local when turned off, and are cut to fit an event', (t) => {
  const c = context(t)
  c.options.prompts = false
  c.capture('claude-code', 'UserPromptSubmit', { prompt: 'PRIVATE' })
  assert.equal(JSON.stringify(c.queue.batch()).includes('PRIVATE'), false)
  assert.equal(promptText('   '), undefined)
  assert.equal(promptText(42), undefined)
  assert.equal(promptText('a'.repeat(5000)).length, 4000)
  // Escaped control characters inflate JSON sixfold; the cut still fits.
  const escaped = promptText('\u0001'.repeat(4000))
  assert.ok(Buffer.byteLength(JSON.stringify(escaped)) <= 12 * 1024)
  assert.equal(/[\uD800-\uDBFF]$/.test(promptText('😀'.repeat(2500))), false)
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
    emitEvent(c.queue, { ...c.queue.batch()[0], response: 'PRIVATE' }),
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

test('Claude Code: a session that ends inside a turn cancels it, and not after Stop', (t) => {
  const c = context(t)
  c.capture('claude-code', 'UserPromptSubmit', { prompt: 'x' })
  c.capture('claude-code', 'SessionEnd', { reason: 'other' })
  assert.deepEqual(
    c.queue.batch().map((e) => e.eventType),
    ['run.started', 'run.cancelled'],
  )
  const d = context(t)
  d.capture('claude-code', 'UserPromptSubmit', { prompt: 'x' })
  d.capture('claude-code', 'Stop', {})
  d.capture('claude-code', 'SessionEnd', { reason: 'prompt_input_exit' })
  assert.deepEqual(
    d.queue.batch().map((e) => e.eventType),
    ['run.started', 'run.observed'],
  )
})

test('Kimi Code 0.38 payloads: numbered turns, Stop and StopFailure without one', (t) => {
  // As Kimi Code 0.38.0 sent them to a hook (session ids shortened).
  const c = context(t)
  const turn = (turn_id, prompt) => ({
    session_id: 'session_a',
    client_type: 'kimi_code_cli',
    turn_id,
    origin_kind: 'user',
    prompt,
  })
  c.capture('kimi-code', 'TurnStarted', turn(0, 'Reply with ok'))
  c.capture('kimi-code', 'Stop', {
    session_id: 'session_a',
    stop_hook_active: false,
  })
  c.capture('kimi-code', 'TurnStarted', turn(1, 'WA_FAIL'))
  c.capture('kimi-code', 'StopFailure', {
    session_id: 'session_a',
    error_type: 'APIStatusError',
    error_message: '400 PRIVATE',
  })
  const events = c.queue.batch()
  assert.deepEqual(
    events.map((e) => e.eventType),
    ['run.started', 'run.observed', 'run.started', 'run.failed'],
  )
  assert.notEqual(events[0].runId, events[2].runId)
  assert.equal(events[0].prompt, 'Reply with ok')
  assert.equal(JSON.stringify(events).includes('PRIVATE'), false)
})

test('hooks of parallel sessions all reach the queue', async (t) => {
  const c = context(t)
  const { spawn } = await import('node:child_process')
  const hook = (session) =>
    new Promise((done) => {
      const child = spawn(
        process.execPath,
        [resolve('dist/cli.js'), 'hook', 'kimi-code'],
        {
          env: {
            ...process.env,
            NODE_NO_WARNINGS: '1',
            WORK_ADDRESS_STATE_DIR: c.dir,
            WORK_ADDRESS_EXPERIMENTAL_ADAPTERS: '1',
            WORK_ADDRESS_HOOK_UPLOAD: '0',
          },
        },
      )
      child.on('exit', done)
      child.stdin.end(
        JSON.stringify({
          session_id: session,
          hook_event_name: 'TurnStarted',
          turn_id: 0,
          origin_kind: 'user',
          prompt: 'x',
        }),
      )
    })
  await Promise.all(['a', 'b', 'c', 'd', 'e', 'f'].map(hook))
  c.reopen()
  assert.equal(c.queue.batch().length, 6)
  assert.equal(c.queue.status().lost, 0)
})

test('Kimi Code: a Stop that lands before its TurnStarted still ends the turn', (t) => {
  for (const [terminal, extra, ending] of [
    ['Stop', {}, 'run.observed'],
    ['StopFailure', { error_type: 'APIStatusError' }, 'run.failed'],
    ['Interrupt', { turn_id: 0, reason: 'cancelled' }, 'run.cancelled'],
  ]) {
    const c = context(t)
    c.capture('kimi-code', terminal, extra)
    c.capture('kimi-code', 'TurnStarted', {
      turn_id: 0,
      origin_kind: 'user',
      prompt: 'x',
    })
    c.capture('kimi-code', 'Stop', {})
    assert.deepEqual(
      c.queue.batch().map((e) => e.eventType),
      terminal === 'Stop'
        ? ['run.started', ending, 'run.observed']
        : ['run.started', ending],
      terminal,
    )
  }
  const s = context(t)
  s.capture('kimi-code', 'Stop', {})
  s.capture('kimi-code', 'TurnStarted', {
    turn_id: 0,
    origin_kind: 'system_trigger',
  })
  assert.equal(s.queue.batch().length, 0)
})

test('Codex 0.169 payloads: a turn that ends with SessionEnd alone failed', (t) => {
  // As Codex 0.169.0 sent them: success, an API error, an interruption.
  const c = context(t)
  const at = (session, name, turn_id) =>
    c.capture('codex', name, {
      session_id: session,
      ...(turn_id ? { turn_id } : {}),
    })
  at('ok', 'UserPromptSubmit', 't1')
  at('ok', 'Stop', 't1')
  at('ok', 'SessionEnd')
  at('fail', 'UserPromptSubmit', 't2')
  at('fail', 'SessionEnd')
  at('stop', 'UserPromptSubmit', 't3')
  at('stop', 'Interrupt', 't3')
  at('stop', 'SessionEnd')
  at('none', 'SessionEnd')
  assert.deepEqual(
    c.queue.batch().map((e) => e.eventType),
    [
      'run.started',
      'run.observed',
      'run.started',
      'run.failed',
      'run.started',
      'run.cancelled',
    ],
  )
})

test('Hermes: a request error that will not be retried fails the turn', (t) => {
  const c = context(t)
  c.capture('hermes', 'pre_llm_call', { ...hermes, user_message: 'Fix it' })
  c.capture('hermes', 'api_request_error', { ...hermes, retryable: true })
  c.capture('hermes', 'api_request_error', { ...hermes, retryable: false })
  c.capture('hermes', 'on_session_end', { ...hermes, completed: true })
  const events = c.queue.batch()
  assert.deepEqual(
    events.map((e) => e.eventType),
    ['run.started', 'run.failed'],
  )
  assert.equal(events[0].prompt, 'Fix it')
})
