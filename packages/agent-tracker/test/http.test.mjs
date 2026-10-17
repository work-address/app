import { test } from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { createMockReceiver } from '../examples/mock-ingest.mjs'
import { fixture } from './fixture.mjs'

test('HTTP development receiver authenticates, validates and deduplicates', async (t) => {
  const credential = 'test-only-credential-0000'
  const server = createMockReceiver({ credential })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => new Promise((resolve) => server.close(resolve)))
  const url = `http://127.0.0.1:${server.address().port}/api/agent-tracking/events`
  const send = (body, token = credential) =>
    fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
  assert.equal((await send({ events: [fixture] }, 'wrong')).status, 401)
  assert.equal(
    (await (await send({ events: [fixture] })).json()).results[0].status,
    'accepted',
  )
  assert.equal(
    (await (await send({ events: [fixture] })).json()).results[0].status,
    'duplicate',
  )
  assert.equal(
    (await send({ events: [{ ...fixture, prompt: 'private' }] })).status,
    400,
  )
  assert.equal(
    (
      await (
        await send({ events: [{ ...fixture, eventType: 'run.failed' }] })
      ).json()
    ).results[0].code,
    'EVENT_ID_CONFLICT',
  )
})
