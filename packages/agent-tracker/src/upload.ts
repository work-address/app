import { spawn } from 'node:child_process'

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

/** No resident service: one `sync` that drains, backs off and exits. The queue lease keeps it single. */
export function startUploader(cli: string): void {
  spawn(process.execPath, [cli, 'sync'], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
    env: { ...process.env, NODE_NO_WARNINGS: '1' },
  })
    .on('error', () => {})
    .unref()
}
