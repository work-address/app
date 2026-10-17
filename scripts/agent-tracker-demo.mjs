import { mkdtempSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import assert from 'node:assert/strict'
import {
  setup,
  EventQueue,
  sync,
} from '../packages/agent-tracker/dist/index.js'
import { OpenClawAdapter } from '../packages/agent-tracker-openclaw/dist/index.js'
import { createMockReceiver } from '../packages/agent-tracker/examples/mock-ingest.mjs'

const directory = mkdtempSync(join(tmpdir(), 'work-address-demo-'))
const credential = 'local-demo-only-credential'
const server = createMockReceiver({ credential })
let queue
try {
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const endpoint = `http://127.0.0.1:${server.address().port}/api/agent-tracking/events`
  const config = setup(
    directory,
    endpoint,
    '677cf211-c57d-49ce-aa82-23fd013bed14',
    credential,
  )
  queue = new EventQueue(directory, config)
  const adapter = new OpenClawAdapter(config)
  const fixture = JSON.parse(
    readFileSync(
      new URL(
        '../packages/agent-tracker-openclaw/test/fixtures/lifecycle.json',
        import.meta.url,
      ),
    ),
  )
  for (const input of fixture.events) {
    const event = adapter.normalize(input)
    if (event) queue.enqueue(event)
  }
  assert.equal(queue.status().queued, 2)
  queue.close()
  queue = new EventQueue(directory, config)
  const result = await sync(queue, config)
  assert.equal(result.sent, 2)
  assert.equal(queue.status().queued, 0)
  console.log(
    'PASS: fixture → OpenClaw adapter → SQLite → restart → authenticated HTTP → acknowledged queue.',
  )
} finally {
  queue?.close()
  if (server.listening) await new Promise((resolve) => server.close(resolve))
  rmSync(directory, { recursive: true, force: true })
}
