import {
  ingestResponseSchema,
  MAX_BATCH_BYTES,
} from '@work-address/agent-tracking-contract'
import { EventQueue } from './queue.js'
import { validateConfig, type CollectorConfig } from './config.js'
export * from './config.js'
export * from './queue.js'

/** One bounded batch per call; callers schedule further attempts or use the CLI. */
export async function sync(
  queue: EventQueue,
  value: CollectorConfig,
  fetcher: typeof fetch = fetch,
) {
  const config = validateConfig(value)
  queue.assertScope(config)
  const owner = queue.acquire()
  if (!owner) return { state: 'busy' as const, sent: 0 }
  try {
    const events = queue.batch()
    if (!events.length) return { state: 'idle' as const, sent: 0 }
    try {
      const body = JSON.stringify({ events })
      if (Buffer.byteLength(body) > MAX_BATCH_BYTES)
        throw new Error('BATCH_TOO_LARGE')
      const response = await fetcher(config.endpoint, {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(10_000),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.credential}`,
        },
        body,
      })
      if (!response.ok) {
        // Error bodies are untrusted and may contain private vendor data.
        await response.body?.cancel().catch(() => {})
        if (
          response.status >= 400 &&
          response.status < 500 &&
          response.status !== 408 &&
          response.status !== 429
        ) {
          queue.acknowledge(
            events.map((event) => ({
              eventId: event.eventId,
              status: 'rejected',
              code: 'HTTP_PERMANENT_FAILURE',
            })),
          )
          return { state: 'rejected' as const, sent: 0 }
        }
        queue.retry(events, response.headers.get('Retry-After'))
        return { state: 'retry' as const, sent: 0 }
      }
      if (!response.body) throw new Error('UPLOAD_FAILED')
      // Bound response bodies, including chunked responses, before JSON decoding.
      const reader = response.body.getReader()
      const chunks: Uint8Array[] = []
      let size = 0
      while (true) {
        const { done, value: chunk } = await reader.read()
        if (done) break
        size += chunk.length
        if (size > 64 * 1024) {
          await reader.cancel()
          throw new Error('RESPONSE_TOO_LARGE')
        }
        chunks.push(chunk)
      }
      const { results } = ingestResponseSchema.parse(
        JSON.parse(Buffer.concat(chunks).toString('utf8')),
      )
      const expected = new Set(events.map((e) => e.eventId))
      const seen = new Set<string>()
      for (const result of results) {
        if (!expected.has(result.eventId) || seen.has(result.eventId))
          throw new Error('INVALID_ACKNOWLEDGEMENT')
        seen.add(result.eventId)
      }
      queue.acknowledge(results)
      queue.retry(events.filter((e) => !seen.has(e.eventId)))
      return { state: 'uploaded' as const, sent: results.length }
    } catch {
      // Never log a response, credential, payload or vendor error body.
      queue.retry(events)
      return { state: 'retry' as const, sent: 0 }
    }
  } finally {
    queue.release(owner)
  }
}
export * from './adapters.js'
