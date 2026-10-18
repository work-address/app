import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseEvent, ingestResponseSchema } from '../dist/index.js'

export const fixture = {
  schemaVersion: 1,
  eventId: 'a15ee873-8ef2-4ee7-a1b0-71dcb6287f7b',
  source: {
    product: 'openclaw',
    surface: 'gateway',
    instanceId: '9c5cd0ba-a35c-4b97-a4d7-8925f52a17be',
    adapterVersion: '0.1.0',
    runtimeVersion: '2026.10.4',
    epoch: '6021ebe2-7588-4d01-ad6f-3c0881b03dbd',
    sequence: 1,
  },
  projectId: '677cf211-c57d-49ce-aa82-23fd013bed14',
  sessionId: 'session',
  runId: 'run',
  agentId: 'root',
  occurredAt: '2026-10-17T10:00:00.000Z',
  observedAt: '2026-10-17T10:00:01.000Z',
  clock: { basis: 'source_wall' },
  capabilities: { runBoundaries: true, externalWaits: 'none', replay: false },
  eventType: 'run.started',
}
test('strict contract rejects private fields at every boundary', () => {
  assert.deepEqual(parseEvent(fixture), fixture)
  for (const input of [
    { ...fixture, prompt: 'secret' },
    { ...fixture, source: { ...fixture.source, email: 'private' } },
    { ...fixture, capabilities: { ...fixture.capabilities, arbitrary: true } },
    { ...fixture, eventType: 'run.failed', sourceDurationMs: -1 },
  ])
    assert.throws(() => parseEvent(input))
})
test('invalid dates, unknown events and unsafe numeric ranges are rejected', () => {
  for (const extra of [
    { occurredAt: 'yesterday' },
    { eventType: 'run.content' },
    { eventType: 'run.failed', sourceDurationMs: Infinity },
  ])
    assert.throws(() => parseEvent({ ...fixture, ...extra }))
})
test('published JSON schema exposes a strict lifecycle/observation union', () => {
  const schema = JSON.parse(
    readFileSync(new URL('../schema/agent-event-v1.json', import.meta.url)),
  )
  assert.equal(schema.oneOf.length, 7)
  assert.ok(schema.oneOf.every((item) => item.additionalProperties === false))
})
test('acknowledgements reject arbitrary response text', () => {
  assert.throws(() =>
    ingestResponseSchema.parse({
      results: [
        {
          eventId: fixture.eventId,
          status: 'rejected',
          code: 'credential leaked here',
        },
      ],
    }),
  )
})

test('observations require explicit evidence and cannot claim an unimplemented human wait', () => {
  const event = {
    ...fixture,
    eventType: 'run.observed',
    observedState: 'unknown',
    evidenceKind: 'lifecycle',
    clock: { basis: 'collector_wall' },
  }
  assert.equal(parseEvent(event).observedState, 'unknown')
  assert.throws(() => parseEvent({ ...event, observedState: 'human_wait' }))
  assert.throws(() => parseEvent({ ...event, evidenceKind: undefined }))
})

test('desktop timer gates require their bounded reason and no private data', () => {
  assert.equal(parseEvent({ ...fixture, eventType: 'tracking.paused', reason: 'idle' }).reason, 'idle')
  assert.equal(parseEvent({ ...fixture, eventType: 'tracking.resumed', reason: 'started' }).reason, 'started')
  assert.throws(() => parseEvent({ ...fixture, eventType: 'tracking.paused' }))
  assert.throws(() => parseEvent({ ...fixture, eventType: 'tracking.resumed', reason: 'idle' }))
  assert.throws(() => parseEvent({ ...fixture, eventType: 'tracking.paused', reason: 'stopped', path: '/private' }))
})
