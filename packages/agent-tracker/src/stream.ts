import type { CodexExecAdapter } from './adapters.js'
import type { EventQueue } from './queue.js'

interface Collector {
  adapter: Pick<CodexExecAdapter, 'normalize' | 'disconnected'>
  queue: Pick<EventQueue, 'enqueue' | 'recordLoss' | 'close'>
}

/** Never close the producer's pipe because telemetry failed. After losing any
 * record, stop interpreting lifecycle boundaries and drain to EOF without storage.
 * A skipped record could have been a start/end, so resuming would misattribute work.
 */
export async function collectCodexStream(
  input: AsyncIterable<Uint8Array>,
  initialize: () => Collector,
  warn: () => void,
): Promise<boolean> {
  let collector: Collector | undefined
  let failed = false
  const fail = () => {
    if (failed) return
    failed = true
    try {
      collector?.queue.recordLoss()
    } catch {
      /* Storage may be unavailable. */
    }
    try {
      const event = collector?.adapter.disconnected()
      if (event) collector?.queue.enqueue(event)
    } catch {
      /* Failure must not break the upstream pipe. */
    }
    try {
      warn()
    } catch {
      /* Logging must not break the upstream pipe. */
    }
  }
  try {
    collector = initialize()
  } catch {
    fail()
  }
  let parts: Buffer[] = []
  let bytes = 0
  const line = () => {
    const value = Buffer.concat(parts, bytes).toString('utf8')
    parts = []
    bytes = 0
    if (!value.trim()) return
    const event = collector!.adapter.normalize(JSON.parse(value))
    if (event && !collector!.queue.enqueue(event)) throw new Error('QUEUE_FULL')
  }
  try {
    for await (const chunk of input) {
      if (failed) continue
      const buffer = Buffer.from(chunk)
      let offset = 0
      try {
        while (offset < buffer.length) {
          const newline = buffer.indexOf(10, offset)
          const end = newline < 0 ? buffer.length : newline
          bytes += end - offset
          if (bytes > 1024 * 1024) throw new Error('LINE_TOO_LARGE')
          parts.push(buffer.subarray(offset, end))
          offset = end + 1
          if (newline >= 0) line()
        }
      } catch {
        parts = []
        bytes = 0
        fail()
      }
    }
    if (!failed) {
      if (bytes) line()
      const event = collector!.adapter.disconnected()
      if (event) {
        collector!.queue.enqueue(event)
        fail() // EOF before a terminal is incomplete, not successful collection.
      }
    }
  } catch {
    fail()
  } finally {
    // An upstream read error cannot be recovered by a consumer.
    try {
      collector?.queue.close()
    } catch {
      fail()
    }
  }
  return !failed
}
