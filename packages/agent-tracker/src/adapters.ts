import { createHash, randomUUID } from 'node:crypto'
import {
  parseEvent,
  type AgentEventV1,
} from '@work-address/agent-tracking-contract'
import type { CollectorConfig } from './config.js'
import type { EventQueue } from './queue.js'

export const serverAdapters = {
  openclaw: {
    status: 'partial',
    transport: 'pinned diagnostic plugin',
    limitation:
      '2026.10.4 only; no waits, replay or cross-product deduplication',
  },
  hermes: {
    status: 'partial',
    transport: 'Python observer bridge',
    limitation:
      'hermes.observer.v1; post-compression start; root turns only; no waits',
  },
  'claude-code': {
    status: 'partial',
    transport: 'command hooks',
    limitation:
      'Stop is provisional; no transcript reconciliation or interruption boundary',
  },
  codex: {
    status: 'partial',
    transport: 'command hooks or live exec JSONL',
    limitation:
      'Hook Stop is provisional; exec stream has no native timestamps or replay',
  },
  'kimi-code': {
    status: 'partial',
    transport: 'command hooks',
    limitation:
      'TurnStarted includes system turns; Stop is provisional; no waits',
  },
  'kimi-server': {
    status: 'unavailable',
    transport: 'experimental Server API',
    limitation:
      'Requires installed openapi/asyncapi schemas and epoch/seq replay qualification; use kimi-code hooks',
  },
  opencode: {
    status: 'partial',
    transport: 'JS plugin via Node bridge',
    limitation:
      'Session status observations only; no qualified turn or child boundaries; not billable',
  },
  cowork: {
    status: 'unavailable',
    transport: 'cloud plugin hooks',
    limitation:
      'Cowork hook schema and sandbox delivery not qualified; manual timer fallback',
  },
  'kimi-legacy': {
    status: 'unavailable',
    transport: 'optional legacy Wire',
    limitation:
      'Requires negotiated protocol and launched-session fixtures; current Kimi mappings are not reused',
  },
  otel: {
    status: 'unavailable',
    transport: 'optional OTLP',
    limitation:
      'No qualified identity/lifecycle span mapping; organisation Cowork OTel is out of scope',
  },
  generic: {
    status: 'partial',
    transport: 'explicit lifecycle emitter',
    limitation:
      'Caller must supply native execution evidence; model-authored timer calls are not native events',
  },
} as const
export type HookProduct =
  | 'hermes'
  | 'claude-code'
  | 'codex'
  | 'kimi-code'
  | 'opencode'
export function isHookProduct(value: string): value is HookProduct {
  return ['hermes', 'claude-code', 'codex', 'kimi-code', 'opencode'].includes(
    value,
  )
}
export function opaque(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('INVALID_INPUT')
  return value as Record<string, unknown>
}
function nativeId(value: unknown): string {
  if (typeof value !== 'string' || !value.length || value.length > 4096)
    throw new Error('MISSING_ID')
  return opaque(value)
}
interface State {
  assignment?: string | null
  run: string
  epoch: string
  sequence: number
  closed: boolean
  stopped: boolean
  suppressed: boolean
  started: boolean
}
function fresh(run: string = randomUUID()): State {
  return {
    run,
    epoch: randomUUID(),
    sequence: 0,
    closed: false,
    stopped: false,
    suppressed: false,
    started: false,
  }
}
export interface CaptureOptions {
  runtimeVersion: string
  agent?: string
  now?: () => number
}
function envelope(
  config: CollectorConfig,
  product: string,
  surface: string,
  session: string,
  state: State,
  options: CaptureOptions,
  eventType: AgentEventV1['eventType'],
  boundaries: boolean,
  observedState: 'running' | 'unknown' = 'unknown',
): AgentEventV1 {
  if (state.assignment === undefined) state.assignment = options.agent ?? null
  const at = new Date((options.now ?? Date.now)()).toISOString()
  return parseEvent({
    schemaVersion: 1,
    eventId: randomUUID(),
    source: {
      product,
      surface,
      instanceId: config.instanceId,
      ...(state.assignment ? { agent: state.assignment } : {}),
      adapterVersion: '0.1.0',
      runtimeVersion: options.runtimeVersion,
      epoch: state.epoch,
      sequence: state.sequence++,
    },
    projectId: config.projectId,
    sessionId: session,
    runId: state.run,
    agentId: 'root',
    occurredAt: at,
    observedAt: at,
    clock: { basis: 'collector_wall' },
    capabilities: {
      runBoundaries: boundaries,
      externalWaits: 'none',
      replay: false,
    },
    eventType,
    ...(eventType === 'run.observed'
      ? {
          observedState,
          evidenceKind: product === 'opencode' ? 'runtime_state' : 'lifecycle',
        }
      : {}),
  })
}

/** Raw fields are read by allowlist. No prompts, paths, titles, model text or errors are persisted. */
export function captureHook(
  queue: EventQueue,
  config: CollectorConfig,
  product: HookProduct,
  input: unknown,
  options: CaptureOptions,
): number {
  const e = object(input)
  const name = e.hook_event_name
  const allowed: Record<HookProduct, string[]> = {
    hermes: ['pre_llm_call', 'on_session_end'],
    'claude-code': ['UserPromptSubmit', 'Stop', 'StopFailure'],
    codex: ['UserPromptSubmit', 'Stop', 'Interrupt'],
    'kimi-code': ['TurnStarted', 'Stop', 'StopFailure', 'Interrupt'],
    opencode: ['busy', 'idle', 'error'],
  }
  if (typeof name !== 'string' || !allowed[product].includes(name)) return 0
  const session = nativeId(e.session_id)
  if (
    product === 'hermes' &&
    e.telemetry_schema_version !== 'hermes.observer.v1'
  )
    throw new Error('UNSUPPORTED_HERMES_SCHEMA')
  const stableTurn = product === 'hermes' || product === 'codex'
  // Legacy Hermes CLI shutdown has no turn ID. It is not a turn terminal.
  if (stableTurn && typeof e.turn_id !== 'string') return 0
  const turn = stableTurn ? nativeId(e.turn_id) : undefined
  const key = opaque(JSON.stringify([product, session, turn ?? 'session']))
  return queue.capture(key, (previous) => {
    let state: State = previous ? JSON.parse(previous) : fresh(turn)
    if (previous && state.assignment === undefined) state.assignment = null
    const events: AgentEventV1[] = []
    const emit = (
      type: AgentEventV1['eventType'],
      observed?: 'running' | 'unknown',
    ) => {
      events.push(
        envelope(
          config,
          product,
          'server-hooks',
          session,
          state,
          options,
          type,
          product === 'hermes',
          observed,
        ),
      )
    }
    const start =
      product === 'hermes'
        ? name === 'pre_llm_call'
        : product === 'kimi-code'
          ? name === 'TurnStarted'
          : product === 'opencode'
            ? name === 'busy'
            : name === 'UserPromptSubmit'
    if (start) {
      if (product === 'hermes' && e.parent_session_id) state.suppressed = true
      // Child identity is not root identity. Never bill both without proven lineage.
      if (product !== 'hermes' && e.agent_id) state.suppressed = true
      if (!state.suppressed) {
        if (product === 'claude-code') {
          // The hook has no turn/invocation identity or steering indicator. Keep
          // submissions separate and provisional rather than joining unrelated work.
          if (previous && state.started && !state.closed && !state.stopped)
            emit('run.observed')
          state = fresh()
        } else if (product === 'kimi-code') {
          const run = nativeId(e.turn_id)
          if (previous && state.run !== run) state = fresh(run)
          else if (!previous) state.run = run
        } else if (!stableTurn && previous && (state.closed || state.stopped))
          state = fresh()
        if (!state.started) {
          emit(
            product === 'opencode' ? 'run.observed' : 'run.started',
            'running',
          )
          state.started = true
        }
        // Native turn IDs deduplicate starts; Claude submissions remain provisional.
      }
    } else if (
      product === 'kimi-code' &&
      e.turn_id &&
      nativeId(e.turn_id) !== state.run
    ) {
      // A late terminal for another turn must not close the current turn.
    } else if (!state.suppressed && (previous || stableTurn) && !state.closed) {
      if (product === 'hermes' && name === 'on_session_end') {
        const flags = [e.completed, e.failed, e.interrupted].filter(
          (v) => v === true,
        ).length
        if (flags !== 1) emit('run.observed')
        else
          emit(
            e.interrupted === true
              ? 'run.cancelled'
              : e.failed === true
                ? 'run.failed'
                : 'run.completed',
          )
        state.closed = true
      } else if (
        name === 'Stop' ||
        (product === 'opencode' && (name === 'idle' || name === 'error'))
      ) {
        emit('run.observed') // Another hook can continue the turn. Never infer success.
        state.stopped = true
      } else if (
        (product === 'codex' || product === 'kimi-code') &&
        name === 'Interrupt'
      ) {
        emit('run.cancelled')
        state.closed = true
      } else if (
        (product === 'claude-code' || product === 'kimi-code') &&
        name === 'StopFailure'
      ) {
        emit('run.failed')
        state.closed = true
      }
    }
    return { state: JSON.stringify(state), events }
  })
}

/** Attach to one live codex exec --json invocation. Do not feed saved/replayed transcripts. */
export class CodexExecAdapter {
  private session: string | undefined
  private state: State | undefined
  private sequence = 0
  private eventSequence = 0
  private readonly epoch = randomUUID()
  constructor(
    private readonly config: CollectorConfig,
    private readonly launchId: string,
    private readonly options: CaptureOptions,
  ) {
    if (!/^[A-Za-z0-9._:-]{1,200}$/.test(launchId))
      throw new Error('INVALID_LAUNCH_ID')
  }
  normalize(input: unknown): AgentEventV1 | undefined {
    const e = object(input)
    if (e.type === 'thread.started') {
      this.session = nativeId(e.thread_id)
      return
    }
    if (!this.session) return
    if (e.type === 'turn.started') {
      if (this.state && !this.state.closed) return
      this.state = fresh(opaque(`${this.launchId}:${this.sequence++}`))
      this.state.epoch = this.epoch
      this.state.sequence = this.eventSequence
      return this.emit('run.started')
    }
    if (!this.state || this.state.closed) return
    if (e.type !== 'turn.completed' && e.type !== 'turn.failed') return
    this.state.closed = true
    return this.emit(
      e.type === 'turn.completed' ? 'run.completed' : 'run.failed',
    )
  }
  disconnected(): AgentEventV1 | undefined {
    if (!this.session || !this.state || this.state.closed) return
    this.state.closed = true
    return this.emit('run.observed')
  }
  private emit(type: AgentEventV1['eventType']): AgentEventV1 {
    const event = envelope(
      this.config,
      'codex',
      'exec-jsonl',
      this.session!,
      this.state!,
      this.options,
      type,
      true,
    )
    this.eventSequence = this.state!.sequence
    return event
  }
}

/** Strict normalized emitter for runtimes with explicit lifecycle evidence. */
export function emitEvent(queue: EventQueue, event: unknown): boolean {
  return queue.enqueue(parseEvent(event))
}
