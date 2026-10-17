import { DatabaseSync } from 'node:sqlite'
import { chmodSync, existsSync, lstatSync } from 'node:fs'
import { join } from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import {
  parseEvent,
  type AgentEventV1,
  type IngestResult,
} from '@work-address/agent-tracking-contract'
import { privateDirectory, type CollectorConfig } from './config.js'

export interface QueueOptions {
  maxBytes?: number
  retentionMs?: number
  now?: () => number
}
export class EventQueue {
  private inTransaction = false
  private readonly db: DatabaseSync
  private readonly now: () => number
  private readonly maxBytes: number
  private readonly retentionMs: number

  constructor(
    directory: string,
    private readonly config: CollectorConfig,
    options: QueueOptions = {},
  ) {
    this.now = options.now ?? Date.now
    this.maxBytes = options.maxBytes ?? 100 * 1024 * 1024
    this.retentionMs = options.retentionMs ?? 7 * 86400_000
    const path = join(privateDirectory(directory), 'queue.sqlite')
    for (const suffix of ['', '-wal', '-shm', '-journal']) {
      if (
        existsSync(path + suffix) &&
        lstatSync(path + suffix).isSymbolicLink()
      )
        throw new Error('UNSAFE_QUEUE_FILE')
    }
    this.db = new DatabaseSync(path)
    chmodSync(path, 0o600)
    this.db
      .exec(`PRAGMA busy_timeout = 25; PRAGMA journal_mode = DELETE; PRAGMA synchronous = FULL;
      CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY, payload TEXT NOT NULL, bytes INTEGER NOT NULL,
        created INTEGER NOT NULL, state TEXT NOT NULL DEFAULT 'pending', code TEXT,
        attempts INTEGER NOT NULL DEFAULT 0, next_attempt INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS adapter_state (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS lease (id INTEGER PRIMARY KEY CHECK(id=1), owner TEXT NOT NULL, expires INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS pending_events ON events(state, next_attempt, created);`)
    // Credential rotation deliberately requires a new state directory for this prototype.
    const scope = createHash('sha256')
      .update(JSON.stringify(config))
      .digest('hex')
    this.db
      .prepare("INSERT OR IGNORE INTO metadata VALUES ('scope', ?)")
      .run(scope)
    if (
      this.db.prepare("SELECT value FROM metadata WHERE key='scope'").get()
        ?.value !== scope
    ) {
      this.db.close()
      throw new Error('QUEUE_SCOPE_MISMATCH')
    }
  }

  assertScope(config: CollectorConfig): void {
    const scope = createHash('sha256')
      .update(JSON.stringify(config))
      .digest('hex')
    if (
      this.db.prepare("SELECT value FROM metadata WHERE key='scope'").get()
        ?.value !== scope
    ) {
      throw new Error('QUEUE_SCOPE_MISMATCH')
    }
  }

  private transaction<T>(fn: () => T): T {
    if (this.inTransaction) return fn()
    this.db.exec('BEGIN IMMEDIATE')
    this.inTransaction = true
    try {
      const value = fn()
      this.db.exec('COMMIT')
      return value
    } catch (e) {
      this.db.exec('ROLLBACK')
      throw e
    } finally {
      this.inTransaction = false
    }
  }

  /** Atomically persist sanitized adapter state and its events across hook processes. */
  capture(
    key: string,
    transition: (previous: string | undefined) => {
      state: string
      events: AgentEventV1[]
    },
  ): number {
    if (!/^[a-f0-9]{64}$/.test(key)) throw new Error('INVALID_STATE_KEY')
    return this.transaction(() => {
      this.db
        .prepare('DELETE FROM adapter_state WHERE updated < ?')
        .run(this.now() - this.retentionMs)
      const previous = this.db
        .prepare('SELECT value FROM adapter_state WHERE key=?')
        .get(key)
      if (
        !previous &&
        Number(
          this.db.prepare('SELECT COUNT(*) AS n FROM adapter_state').get()?.n,
        ) >= 10000
      )
        throw new Error('ADAPTER_STATE_CAPACITY')
      const result = transition(previous ? String(previous.value) : undefined)
      if (Buffer.byteLength(result.state) > 4096 || result.events.length > 2)
        throw new Error('ADAPTER_STATE_TOO_LARGE')
      let count = 0
      for (const event of result.events) if (this.enqueue(event)) count++
      this.db
        .prepare(
          'INSERT INTO adapter_state VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated=excluded.updated',
        )
        .run(key, result.state, this.now())
      return count
    })
  }

  recordLoss(count = 1): void {
    this.db
      .prepare(
        "INSERT INTO metadata VALUES ('lost', ?) ON CONFLICT(key) DO UPDATE SET value = CAST(value AS INTEGER) + excluded.value",
      )
      .run(String(count))
  }

  private expire(): void {
    const deleted = this.db
      .prepare('DELETE FROM events WHERE created < ?')
      .run(this.now() - this.retentionMs)
    if (deleted.changes) this.recordLoss(Number(deleted.changes))
  }

  enqueue(value: unknown): boolean {
    const event = parseEvent(value)
    if (
      event.projectId !== this.config.projectId ||
      event.source.instanceId !== this.config.instanceId
    )
      throw new Error('EVENT_SCOPE_MISMATCH')
    const payload = JSON.stringify(event)
    const bytes = Buffer.byteLength(payload)
    return this.transaction(() => {
      this.expire()
      const previous = this.db
        .prepare('SELECT payload FROM events WHERE id=?')
        .get(event.eventId)
      if (previous) {
        const oldEvent = JSON.parse(String(previous.payload))
        if (
          JSON.stringify({ ...oldEvent, observedAt: event.observedAt }) !==
          payload
        )
          throw new Error('EVENT_ID_CONFLICT')
        return true
      }
      const used = Number(
        this.db
          .prepare('SELECT COALESCE(SUM(bytes),0) AS bytes FROM events')
          .get()?.bytes,
      )
      if (used + bytes > this.maxBytes) {
        this.recordLoss()
        return false
      }
      this.db
        .prepare('INSERT INTO events(id,payload,bytes,created) VALUES(?,?,?,?)')
        .run(event.eventId, payload, bytes, this.now())
      return true
    })
  }

  acquire(): string | undefined {
    const owner = randomUUID()
    return this.transaction(() => {
      this.db.prepare('DELETE FROM lease WHERE expires <= ?').run(this.now())
      const result = this.db
        .prepare('INSERT OR IGNORE INTO lease VALUES(1,?,?)')
        .run(owner, this.now() + 30_000)
      return result.changes ? owner : undefined
    })
  }
  release(owner: string): void {
    this.db.prepare('DELETE FROM lease WHERE owner=?').run(owner)
  }

  batch(): AgentEventV1[] {
    this.transaction(() => this.expire())
    const rows = this.db
      .prepare(
        "SELECT payload FROM events WHERE state='pending' AND next_attempt <= ? ORDER BY created, rowid LIMIT 50",
      )
      .all(this.now())
    // 50 x 16 KiB plus envelope is below the 1 MiB request cap.
    return rows.map((row) => parseEvent(JSON.parse(String(row.payload))))
  }

  acknowledge(results: IngestResult[]): void {
    this.transaction(() => {
      for (const result of results) {
        if (result.status === 'rejected') {
          this.db
            .prepare("UPDATE events SET state='rejected', code=? WHERE id=?")
            .run(result.code, result.eventId)
        } else
          this.db.prepare('DELETE FROM events WHERE id=?').run(result.eventId)
      }
    })
  }

  retry(events: AgentEventV1[]): void {
    this.transaction(() => {
      for (const event of events) {
        const row = this.db
          .prepare('SELECT attempts FROM events WHERE id=?')
          .get(event.eventId)
        if (!row) continue
        const attempts = Number(row.attempts) + 1
        const delay = Math.min(3600_000, 1000 * 2 ** Math.min(attempts, 12))
        this.db
          .prepare('UPDATE events SET attempts=?,next_attempt=? WHERE id=?')
          .run(attempts, this.now() + delay, event.eventId)
      }
    })
  }

  status() {
    const rows = this.db
      .prepare('SELECT state, COUNT(*) AS count FROM events GROUP BY state')
      .all()
    const count = (state: string) =>
      Number(rows.find((row) => row.state === state)?.count ?? 0)
    return {
      queued: count('pending'),
      rejected: count('rejected'),
      lost: Number(
        this.db.prepare("SELECT value FROM metadata WHERE key='lost'").get()
          ?.value ?? 0,
      ),
    }
  }
  close(): void {
    this.db.close()
  }
}
