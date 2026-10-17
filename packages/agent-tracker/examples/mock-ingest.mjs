// Development receiver only. Loopback binding; no production database is touched.
import { createServer } from 'node:http'
import { createHash, timingSafeEqual } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import {
  parseEvent,
  MAX_BATCH_BYTES,
  MAX_BATCH_EVENTS,
} from '@work-address/agent-tracking-contract'

export function createMockReceiver({ credential, database = ':memory:' }) {
  if (!credential || credential.length < 16)
    throw new Error(
      'Provide a development credential of at least 16 characters',
    )
  const db = new DatabaseSync(database)
  db.exec(
    'CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, hash TEXT NOT NULL)',
  )
  const secret = Buffer.from(`Bearer ${credential}`)
  const server = createServer(async (req, res) => {
    const reply = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(body))
    }
    const supplied = Buffer.from(req.headers.authorization ?? '')
    if (supplied.length !== secret.length || !timingSafeEqual(supplied, secret))
      return reply(401, { error: 'UNAUTHORIZED' })
    if (req.method !== 'POST' || req.url !== '/api/agent-tracking/events')
      return reply(404, { error: 'NOT_FOUND' })
    try {
      const chunks = []
      let size = 0
      for await (const chunk of req) {
        size += chunk.length
        if (size > MAX_BATCH_BYTES) {
          reply(413, { error: 'TOO_LARGE' })
          return
        }
        chunks.push(chunk)
      }
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
      if (
        Object.keys(body).some((key) => key !== 'events') ||
        !Array.isArray(body.events) ||
        body.events.length > MAX_BATCH_EVENTS
      )
        throw new Error('INVALID_BATCH')
      const events = body.events.map(parseEvent)
      db.exec('BEGIN IMMEDIATE')
      try {
        const results = events.map((event) => {
          const hash = createHash('sha256')
            .update(JSON.stringify(event))
            .digest('hex')
          const previous = db
            .prepare('SELECT hash FROM events WHERE id=?')
            .get(event.eventId)
          if (previous)
            return previous.hash === hash
              ? { eventId: event.eventId, status: 'duplicate' }
              : {
                  eventId: event.eventId,
                  status: 'rejected',
                  code: 'EVENT_ID_CONFLICT',
                }
          db.prepare('INSERT INTO events VALUES(?,?)').run(event.eventId, hash)
          return { eventId: event.eventId, status: 'accepted' }
        })
        db.exec('COMMIT')
        reply(200, { results })
      } catch (error) {
        db.exec('ROLLBACK')
        throw error
      }
    } catch {
      reply(400, { error: 'INVALID_BATCH' })
    }
  })
  server.on('close', () => db.close())
  return server
}

if (
  import.meta.url ===
  (await import('node:url')).pathToFileURL(process.argv[1] ?? '').href
) {
  const server = createMockReceiver({
    credential: process.env.WORK_ADDRESS_MOCK_CREDENTIAL,
    database: process.env.WORK_ADDRESS_MOCK_DB ?? ':memory:',
  })
  server.listen(4199, '127.0.0.1', () =>
    console.log(
      'Development receiver: http://127.0.0.1:4199/api/agent-tracking/events',
    ),
  )
}
