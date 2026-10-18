import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  setup,
  readConfig,
  readProcessScope,
  EventQueue,
  captureHook,
} from '../dist/index.js'

test('setup uses the credential source identity and process overrides isolate queues', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'wa-scope-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const instanceId = randomUUID(),
    projectId = randomUUID()
  const base = setup(
    directory,
    'https://example.test/api/agent-tracking/events',
    projectId,
    'private-test-credential',
    instanceId,
  )
  assert.equal(base.instanceId, instanceId)
  assert.equal(readProcessScope(directory, {}).directory, directory)
  const overridden = readProcessScope(directory, {
    WORK_ADDRESS_PROJECT: randomUUID(),
    WORK_ADDRESS_AGENT: 'research',
  })
  const other = readProcessScope(directory, {
    WORK_ADDRESS_PROJECT: overridden.config.projectId,
    WORK_ADDRESS_AGENT: 'review',
  })
  assert.notEqual(overridden.directory, directory)
  assert.notEqual(overridden.directory, other.directory)
  assert.equal(overridden.config.instanceId, instanceId)
  assert.deepEqual(readConfig(directory), base)
  assert.throws(() =>
    readProcessScope(directory, { WORK_ADDRESS_AGENT: '../private' }),
  )
  assert.throws(() =>
    readProcessScope(directory, { WORK_ADDRESS_PROJECT: 'not-a-uuid' }),
  )
  const queue = new EventQueue(overridden.directory, overridden.config)
  try {
    const options = { runtimeVersion: 'fixture', agent: overridden.agent }
    captureHook(
      queue,
      overridden.config,
      'hermes',
      {
        telemetry_schema_version: 'hermes.observer.v1',
        hook_event_name: 'pre_llm_call',
        session_id: 's',
        turn_id: 't',
      },
      options,
    )
    options.agent = 'review'
    captureHook(
      queue,
      overridden.config,
      'hermes',
      {
        telemetry_schema_version: 'hermes.observer.v1',
        hook_event_name: 'on_session_end',
        session_id: 's',
        turn_id: 't',
        completed: true,
      },
      options,
    )
    assert.equal(queue.batch().length, 2)
    assert.ok(
      queue
        .batch()
        .every(
          (e) =>
            e.source.agent === 'research' &&
            e.projectId === overridden.config.projectId,
        ),
    )
    const isolated = new EventQueue(other.directory, other.config)
    try {
      assert.equal(isolated.status().queued, 0)
    } finally {
      isolated.close()
    }
  } finally {
    queue.close()
  }
})
