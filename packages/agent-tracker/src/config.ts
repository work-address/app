import {
  mkdirSync,
  lstatSync,
  chmodSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { resolve, join } from 'node:path'
import { homedir } from 'node:os'
import { createHash, randomUUID } from 'node:crypto'

export interface CollectorConfig {
  endpoint: string
  projectId: string
  instanceId: string
  credential: string
}

export function privateDirectory(directory: string): string {
  const path = resolve(directory)
  mkdirSync(path, { recursive: true, mode: 0o700 })
  if (!lstatSync(path).isDirectory() || lstatSync(path).isSymbolicLink())
    throw new Error('UNSAFE_STATE_DIRECTORY')
  chmodSync(path, 0o700)
  return path
}

export function stateDirectory(): string {
  return (
    process.env.WORK_ADDRESS_STATE_DIR ??
    join(homedir(), '.work-address', 'agent-tracker')
  )
}

export function validateConfig(value: unknown): CollectorConfig {
  if (!value || typeof value !== 'object') throw new Error('INVALID_CONFIG')
  const c = value as Record<string, unknown>
  if (
    Object.keys(c).some(
      (k) => !['endpoint', 'projectId', 'instanceId', 'credential'].includes(k),
    )
  )
    throw new Error('INVALID_CONFIG')
  if (
    typeof c.endpoint !== 'string' ||
    typeof c.credential !== 'string' ||
    !/^[\x21-\x7e]{16,512}$/.test(c.credential)
  )
    throw new Error('INVALID_CONFIG')
  const url = new URL(c.endpoint)
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback))
  )
    throw new Error('UNSAFE_ENDPOINT')
  for (const field of ['projectId', 'instanceId']) {
    if (
      typeof c[field] !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        c[field] as string,
      )
    )
      throw new Error('INVALID_CONFIG')
  }
  return {
    endpoint: url.href,
    projectId: c.projectId as string,
    instanceId: c.instanceId as string,
    credential: c.credential,
  }
}

export function readConfig(directory: string): CollectorConfig {
  const path = join(directory, 'config.json')
  const stat = lstatSync(path)
  if (
    !stat.isFile() ||
    stat.isSymbolicLink() ||
    (process.platform !== 'win32' && (stat.mode & 0o077) !== 0)
  )
    throw new Error('UNSAFE_CONFIG_PERMISSIONS')
  return validateConfig(JSON.parse(readFileSync(path, 'utf8')))
}

/** Process overrides get separate durable queues; they never retarget a backlog. */
export function readProcessScope(
  directory: string,
  environment: Partial<
    Pick<NodeJS.ProcessEnv, 'WORK_ADDRESS_PROJECT' | 'WORK_ADDRESS_AGENT'>
  > = process.env,
): { config: CollectorConfig; directory: string; agent?: string } {
  const stored = readConfig(directory)
  const agent = environment.WORK_ADDRESS_AGENT
  if (agent !== undefined && !/^[a-z0-9][a-z0-9-]{0,59}$/.test(agent))
    throw new Error('INVALID_AGENT_HANDLE')
  const config = validateConfig({
    ...stored,
    projectId: environment.WORK_ADDRESS_PROJECT ?? stored.projectId,
  })
  const separate = config.projectId !== stored.projectId || agent !== undefined
  const key = createHash('sha256')
    .update(JSON.stringify([config.projectId, agent ?? null]))
    .digest('hex')
  return {
    config,
    directory: separate ? join(directory, 'scopes', key) : directory,
    agent,
  }
}

/** Setup never overwrites an existing identity or redirects its queued events. */
export function setup(
  directory: string,
  endpoint: string,
  projectId: string,
  credential: string,
  instanceId: string = randomUUID(),
): CollectorConfig {
  const config = validateConfig({
    endpoint,
    projectId,
    credential,
    instanceId,
  })
  writeFileSync(
    join(privateDirectory(directory), 'config.json'),
    JSON.stringify(config, null, 2) + '\n',
    { mode: 0o600, flag: 'wx' },
  )
  return config
}
