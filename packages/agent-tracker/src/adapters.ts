import { createHash, randomUUID } from 'node:crypto'
import {
  MAX_EVENT_BYTES,
  MAX_PROMPT_CHARS,
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
      'Stop is provisional; SessionEnd inside a turn cancels it; no transcript reconciliation',
  },
  codex: {
    status: 'partial',
    transport: 'command hooks or live exec JSONL',
    limitation:
      'Hook Stop is provisional; SessionEnd inside a turn fails it; exec stream has no native timestamps or replay',
  },
  'kimi-code': {
    status: 'partial',
    transport: 'command hooks',
    limitation:
      'System-triggered turns left out; Stop is provisional; no waits',
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
/**
 * Kimi Code's TurnStarted also fires for turns it starts itself. A turn the
 * person typed (`user`) or a task they launched (`task`) is work; a
 * `system_trigger` or any other origin is left out, with its Stop. Releases
 * that send no origin are read as the person's.
 */
function kimiRecorded(origin: unknown): boolean {
  return origin === undefined || origin === 'user' || origin === 'task'
}
function kimiPersonTurn(origin: unknown): boolean {
  return origin === undefined || origin === 'user'
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
  // Kimi Code numbers its turns (0, 1, …) within a session.
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0)
    value = String(value)
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
  /** Kimi Code: a terminal that ran before the session's first TurnStarted. */
  early?: 'Stop' | 'StopFailure' | 'Interrupt'
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
  /** False keeps the prompt on this machine; the run is still timed. */
  prompts?: boolean
  now?: () => number
}
/** The prompt cut to fit the contract, leaving the rest of the event room inside MAX_EVENT_BYTES. */
export function promptText(value: unknown): string | undefined {
  if (typeof value !== 'string') return
  let text = value.trim().slice(0, MAX_PROMPT_CHARS)
  while (Buffer.byteLength(JSON.stringify(text)) > MAX_EVENT_BYTES - 4096)
    text = text.slice(0, Math.floor(text.length * 0.9))
  // Never end on half a surrogate pair.
  if (/[\uD800-\uDBFF]$/.test(text)) text = text.slice(0, -1)
  return text || undefined
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
  prompt?: string,
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
      adapterVersion: '0.2.0',
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
    ...(eventType === 'run.started' && prompt ? { prompt } : {}),
  })
}

/** Raw fields are read by allowlist. Only the prompt that starts a run is kept; no paths, titles, model text or errors. */
export function captureHook(
  queue: EventQueue,
  config: CollectorConfig,
  product: HookProduct,
  input: unknown,
  options: CaptureOptions,
): number {
  let e = object(input)
  const name = e.hook_event_name
  const allowed: Record<HookProduct, string[]> = {
    hermes: ['pre_llm_call', 'on_session_end', 'api_request_error'],
    'claude-code': ['UserPromptSubmit', 'Stop', 'StopFailure', 'SessionEnd'],
    codex: ['UserPromptSubmit', 'Stop', 'Interrupt', 'SessionEnd'],
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
  if (product === 'codex') {
    // Codex ends a failed turn with SessionEnd alone, and SessionEnd names no
    // turn: remember the session's latest turn so it can be closed.
    const latest = opaque(JSON.stringify([product, session, 'latest-turn']))
    if (name === 'UserPromptSubmit' && typeof e.turn_id === 'string') {
      const turn = e.turn_id
      queue.capture(latest, () => ({ state: turn, events: [] }))
    } else if (name === 'SessionEnd') {
      let turn: string | undefined
      queue.capture(latest, (previous) => {
        turn = previous || undefined
        return { state: previous ?? '', events: [] }
      })
      if (!turn) return 0
      e = { ...e, turn_id: turn }
    }
  }
  const stableTurn = product === 'hermes' || product === 'codex'
  // Legacy Hermes CLI shutdown has no turn ID. It is not a turn terminal.
  if (stableTurn && typeof e.turn_id !== 'string') return 0
  const turn = stableTurn ? nativeId(e.turn_id) : undefined
  const key = opaque(JSON.stringify([product, session, turn ?? 'session']))
  const count = queue.capture(key, (previous) => {
    let state: State = previous ? JSON.parse(previous) : fresh(turn)
    if (previous && state.assignment === undefined) state.assignment = null
    const events: AgentEventV1[] = []
    const emit = (
      type: AgentEventV1['eventType'],
      observed?: 'running' | 'unknown',
      prompt?: string,
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
          prompt,
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
      if (product === 'kimi-code') {
        // A new turn ID is a new run, even after a turn that was left out.
        const run = nativeId(e.turn_id)
        if (!previous || (state.early && !state.started)) state.run = run
        else if (state.run !== run) state = fresh(run)
        if (!kimiRecorded(e.origin_kind)) state.suppressed = true
      }
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
          // Its run was settled above.
        } else if (!stableTurn && previous && (state.closed || state.stopped))
          state = fresh()
        if (!state.started) {
          emit(
            product === 'opencode' ? 'run.observed' : 'run.started',
            'running',
            // Claude Code and Codex pass the submitted text on UserPromptSubmit,
            // Kimi Code on the TurnStarted of a turn the person started.
            options.prompts !== false &&
              (product === 'claude-code' ||
                product === 'codex' ||
                (product === 'kimi-code' && kimiPersonTurn(e.origin_kind)))
              ? promptText(e.prompt)
              : // Hermes Agent passes it to pre_llm_call as user_message.
                options.prompts !== false && product === 'hermes'
                ? promptText(e.user_message)
                : undefined,
          )
          state.started = true
          // Kimi Code runs a session's hooks in parallel: on a quick turn its
          // Stop may land first. Nothing came before it, so it is this turn's.
          if (state.early) {
            const early = state.early
            delete state.early
            if (early === 'Stop') {
              emit('run.observed')
              state.stopped = true
            } else {
              emit(early === 'Interrupt' ? 'run.cancelled' : 'run.failed')
              state.closed = true
            }
          }
        }
        // Native turn IDs deduplicate starts; Claude submissions remain provisional.
      }
    } else if (
      product === 'kimi-code' &&
      previous &&
      e.turn_id !== undefined &&
      e.turn_id !== null &&
      nativeId(e.turn_id) !== state.run
    ) {
      // A late terminal for another turn must not close the current turn.
    } else if (
      product === 'kimi-code' &&
      !previous &&
      (name === 'Stop' || name === 'StopFailure' || name === 'Interrupt')
    ) {
      state.early = name
    } else if (!state.suppressed && (previous || stableTurn) && !state.closed) {
      if (product === 'hermes' && name === 'api_request_error') {
        // Sent only when the request will not be retried: the turn failed.
        if (e.retryable === false) {
          emit('run.failed')
          state.closed = true
        }
      } else if (product === 'hermes' && name === 'on_session_end') {
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
      } else if (product === 'codex' && name === 'SessionEnd') {
        // No Stop and no Interrupt came: the turn ended without completing,
        // as an API error ends it.
        if (!state.stopped) emit('run.failed')
        state.closed = true
      } else if (product === 'claude-code' && name === 'SessionEnd') {
        // Claude Code has no Interrupt hook: a session that ends inside a
        // turn (Ctrl+C, a killed process) ends it unfinished. After Stop the
        // turn already has its provisional end.
        if (!state.stopped) emit('run.cancelled')
        state.closed = true
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
  if (
    product === 'kimi-code' &&
    name === 'TurnStarted' &&
    kimiRecorded(e.origin_kind) &&
    !e.agent_id
  )
    rememberKimiTurn(queue, e.session_id, e.turn_id)
  return count
}

const KIMI_OPEN = opaque(JSON.stringify(['kimi-code', 'open-turns']))
const KIMI_OPEN_MAX = 20
export interface KimiOpenTurn {
  /** Kimi's own session id: its session store is found by it. Local only. */
  session: string
  turn: number | string
  at: number
}

function readKimiOpen(value: string | undefined): KimiOpenTurn[] {
  try {
    const list = JSON.parse(value ?? '[]')
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

/**
 * Kimi Code 2.x fires no hook when a turn ends normally, so the turns this
 * collector started are listed until Kimi's session store says how they
 * ended (kimi-store.ts).
 */
function rememberKimiTurn(
  queue: EventQueue,
  session: unknown,
  turn: unknown,
): void {
  if (typeof session !== 'string' || !/^[\w.-]{1,200}$/.test(session)) return
  if (typeof turn !== 'number' && typeof turn !== 'string') return
  queue.capture(KIMI_OPEN, (previous) => {
    const list = readKimiOpen(previous).filter((t) => t.session !== session)
    list.push({ session, turn, at: Date.now() })
    return { state: JSON.stringify(list.slice(-KIMI_OPEN_MAX)), events: [] }
  })
}

/** The Kimi turns still open, oldest first; `keep` decides which stay listed. */
export function kimiOpenTurns(
  queue: EventQueue,
  keep: (turn: KimiOpenTurn) => boolean = () => true,
): KimiOpenTurn[] {
  let open: KimiOpenTurn[] = []
  queue.capture(KIMI_OPEN, (previous) => {
    open = readKimiOpen(previous)
    return { state: JSON.stringify(open.filter(keep)), events: [] }
  })
  return open
}

/**
 * Ends an open Kimi turn as its session store recorded it. The store is
 * Kimi's own account, so a completed turn is completed, not provisional.
 */
export function captureKimiEnd(
  queue: EventQueue,
  config: CollectorConfig,
  open: KimiOpenTurn,
  ending: 'completed' | 'failed' | 'cancelled' | string,
  at: number,
  options: CaptureOptions,
): number {
  const session = nativeId(open.session)
  const key = opaque(JSON.stringify(['kimi-code', session, 'session']))
  return queue.capture(key, (previous) => {
    if (!previous) return { state: '', events: [] }
    const state: State = JSON.parse(previous)
    if (state.suppressed || state.closed || state.run !== nativeId(open.turn))
      return { state: previous, events: [] }
    const type: AgentEventV1['eventType'] =
      ending === 'completed'
        ? 'run.completed'
        : ending === 'failed'
          ? 'run.failed'
          : ending === 'cancelled'
            ? 'run.cancelled'
            : 'run.observed'
    const event = envelope(
      config,
      'kimi-code',
      'server-hooks',
      session,
      state,
      { ...options, now: () => at },
      type,
      false,
    )
    state.closed = true
    return { state: JSON.stringify(state), events: [event] }
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
