import { createHash, randomUUID } from 'node:crypto'
import {
  parseEvent,
  type AgentEventV1,
} from '@work-address/agent-tracking-contract'

export const OPENCLAW_VERSION = '2026.10.4'
export const ADAPTER_VERSION = '0.1.0'
export interface AdapterOptions {
  instanceId: string
  projectId: string
  epoch?: string
  now?: () => number
}

function opaque(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}
function eventUuid(value: string): string {
  const hex = opaque(value)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

/** Only the outer run stream is collected: harness/model/tool spans are not extra runs. */
export class OpenClawAdapter {
  private readonly epoch: string
  private readonly now: () => number
  constructor(private readonly options: AdapterOptions) {
    this.epoch = options.epoch ?? randomUUID()
    this.now = options.now ?? Date.now
  }

  normalize(input: unknown): AgentEventV1 | undefined {
    if (!input || typeof input !== 'object') return undefined
    const e = input as Record<string, unknown>
    if (e.type !== 'run.started' && e.type !== 'run.completed') return undefined
    if (typeof e.runId !== 'string' || !e.runId.length || e.runId.length > 4096)
      throw new Error('MISSING_RUN_ID')
    if (
      typeof e.ts !== 'number' ||
      !Number.isSafeInteger(e.ts) ||
      e.ts < 0 ||
      e.ts > 8.64e15
    )
      throw new Error('INVALID_SOURCE_TIME')
    if (typeof e.seq !== 'number' || !Number.isSafeInteger(e.seq) || e.seq < 0)
      throw new Error('INVALID_SOURCE_SEQUENCE')
    let eventType: AgentEventV1['eventType'] = 'run.started'
    if (e.type === 'run.completed') {
      if (
        !['completed', 'aborted', 'blocked', 'error'].includes(
          String(e.outcome),
        )
      )
        throw new Error('UNKNOWN_OUTCOME')
      eventType =
        e.outcome === 'completed'
          ? 'run.completed'
          : e.outcome === 'aborted'
            ? 'run.cancelled'
            : 'run.failed'
    }
    // A run-specific synthetic namespace avoids session keys (which can contain addresses)
    // and remains stable even when optional session/agent fields differ at start and end.
    const runId = opaque(e.runId)
    const event = {
      schemaVersion: 1,
      eventId: eventUuid(
        JSON.stringify([
          this.options.instanceId,
          this.epoch,
          e.type,
          e.runId,
          e.ts,
          e.seq,
        ]),
      ),
      source: {
        product: 'openclaw',
        surface: 'gateway',
        instanceId: this.options.instanceId,
        adapterVersion: ADAPTER_VERSION,
        runtimeVersion: OPENCLAW_VERSION,
        epoch: this.epoch,
        sequence: e.seq,
      },
      projectId: this.options.projectId,
      sessionId: `run-${runId}`,
      runId,
      agentId: 'root',
      occurredAt: new Date(e.ts).toISOString(),
      observedAt: new Date(this.now()).toISOString(),
      clock: { basis: 'source_wall' },
      capabilities: {
        runBoundaries: true,
        externalWaits: 'none',
        replay: false,
      },
      eventType,
      ...(e.type === 'run.completed' && e.durationMs !== undefined
        ? { sourceDurationMs: e.durationMs }
        : {}),
    }
    // No vendor object is spread into the envelope. Unknown content never enters storage.
    return parseEvent(event)
  }
}
