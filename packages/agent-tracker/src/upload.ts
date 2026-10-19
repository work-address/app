import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'
import { sync } from './sync.js'
import type { EventQueue } from './queue.js'
import type { CollectorConfig } from './config.js'

const BOUNDARIES = new Set([
  'SessionStart',
  'SessionEnd',
  'Stop',
  'StopFailure',
  'Interrupt',
  'on_session_end',
  'idle',
  'error',
])
// Only hooks whose configured timeout leaves room for a network round trip.
const FLUSHES = new Set(['Stop', 'StopFailure'])
const EPHEMERAL = [
  'CLAUDE_CODE_REMOTE',
  'CI',
  'CONTINUOUS_INTEGRATION',
  'GITHUB_ACTIONS',
  'GITLAB_CI',
  'BUILDKITE',
  'CIRCLECI',
  'JENKINS_URL',
]
const set = (value: string | undefined) =>
  value !== undefined && !['', '0', 'false'].includes(value.toLowerCase())

/** A request that cannot finish only pushes its batch into backoff. */
export const MIN_REQUEST_MS = 1000
/** How long the detached uploader waits out backoff before leaving the rest to the next hook. */
export const DETACHED_WAIT_MS = 5 * 60_000

/**
 * The upload a hook event starts. Session boundaries and stops start a
 * short-lived detached uploader; in cloud sandboxes and CI a stop also
 * flushes before the hook returns, because the VM may be reclaimed.
 * `WORK_ADDRESS_HOOK_UPLOAD=0` leaves uploads to `agent-tracker sync`.
 */
export function uploadTrigger(
  name: unknown,
  env: NodeJS.ProcessEnv = process.env,
): 'none' | 'detached' | 'flush' {
  if (
    typeof name !== 'string' ||
    !BOUNDARIES.has(name) ||
    env.WORK_ADDRESS_HOOK_UPLOAD === '0'
  )
    return 'none'
  return FLUSHES.has(name) && EPHEMERAL.some((key) => set(env[key]))
    ? 'flush'
    : 'detached'
}

/** No resident service: one `sync` that drains, waits out backoff and exits. The queue lease keeps it single. */
export function startUploader(cli: string): void {
  spawn(process.execPath, [cli, 'sync'], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
    env: {
      WORK_ADDRESS_SYNC_WAIT_MS: String(DETACHED_WAIT_MS),
      ...process.env,
      NODE_NO_WARNINGS: '1',
    },
  })
    .on('error', () => {})
    .unref()
}

export interface DrainOptions {
  /** No request starts after this; a flush inside a hook's budget sets it. */
  deadline?: number
  /** Backoff due before this is slept through; otherwise the drain returns. */
  waitUntil?: number
  maxBatches?: number
  requestTimeoutMs?: number
  fetcher?: typeof fetch
  now?: () => number
}
export type DrainResult =
  | 'drained'
  | 'waiting'
  | 'retry'
  | 'busy'
  | 'incomplete'

/**
 * Upload due batches until nothing is pending. Events a failed request put
 * into backoff are waited for while `waitUntil` allows, so one transient
 * failure does not strand them until the next hook; otherwise `waiting` or
 * `retry` says what is left and why.
 */
export async function drain(
  queue: EventQueue,
  config: CollectorConfig,
  options: DrainOptions = {},
): Promise<DrainResult> {
  const now = options.now ?? Date.now
  const deadline = options.deadline ?? Infinity
  const waitUntil = options.waitUntil ?? now()
  const requestTimeoutMs = options.requestTimeoutMs ?? 10_000
  for (let attempts = 0; attempts < (options.maxBatches ?? 20); attempts++) {
    const remaining = deadline - now()
    if (remaining < MIN_REQUEST_MS) return 'incomplete'
    const result = await sync(
      queue,
      config,
      options.fetcher ?? fetch,
      Math.min(requestTimeoutMs, remaining),
    )
    if (result.state === 'busy') return 'busy'
    if (result.state === 'uploaded' || result.state === 'rejected') continue
    // Idle or retry: whatever is still pending is in backoff.
    const due = queue.nextAttemptAt()
    if (due === undefined) return 'drained'
    if (due > waitUntil || due + MIN_REQUEST_MS > deadline)
      return result.state === 'retry' ? 'retry' : 'waiting'
    await sleep(Math.max(0, due - now()))
  }
  return 'incomplete'
}
