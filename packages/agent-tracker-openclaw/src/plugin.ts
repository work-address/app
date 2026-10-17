import {
  EventQueue,
  readConfig,
  sync,
  type CollectorConfig,
} from '@work-address/agent-tracker'
import { OpenClawAdapter, OPENCLAW_VERSION } from './index.js'

/** Narrow structural boundary, checked against the pinned SDK by verify-sdk.mjs. */
export interface PluginApi {
  pluginConfig?: Record<string, unknown>
  runtime: { version: string }
  logger: { warn(message: string): void }
  registerService(service: {
    id: string
    start(): void | Promise<void>
    stop(): void | Promise<void>
  }): void
}
export interface DiagnosticSdk {
  areDiagnosticsEnabledForProcess(): boolean
  onInternalDiagnosticEvent(
    listener: (event: unknown, metadata: { trusted: boolean }) => void,
    filter: { include: ('run.started' | 'run.completed')[] },
  ): () => void
}

// Late resolution uses the host's SDK; importing the adapter library never loads OpenClaw.
async function loadSdk(): Promise<DiagnosticSdk> {
  const specifier: string = 'openclaw/plugin-sdk/diagnostic-runtime'
  return (await import(specifier)) as DiagnosticSdk
}

export function register(api: PluginApi, sdkLoader = loadSdk): void {
  let queue: EventQueue | undefined
  let config: CollectorConfig
  let unsubscribe: (() => void) | undefined
  let timer: ReturnType<typeof setInterval> | undefined
  let flight: Promise<unknown> | undefined
  let stopped = true
  let lastWarning = 0
  const warn = () => {
    if (Date.now() - lastWarning > 60_000) {
      lastWarning = Date.now()
      api.logger.warn(
        'Work Address collector unavailable or incomplete; inspect agent-tracker status. Agent execution continues.',
      )
    }
  }
  const flush = () => {
    if (!queue || stopped || flight) return
    flight = sync(queue, config)
      .then((result) => {
        if (result.state === 'retry') warn()
      })
      .catch(warn)
      .finally(() => {
        flight = undefined
      })
  }
  api.registerService({
    id: 'work-address-agent-tracker',
    async start() {
      if (!stopped) return
      try {
        if (api.runtime.version !== OPENCLAW_VERSION)
          throw new Error('UNSUPPORTED_OPENCLAW_VERSION')
        const directory = api.pluginConfig?.stateDirectory
        if (typeof directory !== 'string' || !directory)
          throw new Error('MISSING_STATE_DIRECTORY')
        config = readConfig(directory)
        queue = new EventQueue(directory, config)
        const adapter = new OpenClawAdapter(config)
        const sdk = await sdkLoader()
        if (!sdk.areDiagnosticsEnabledForProcess())
          throw new Error('DIAGNOSTICS_DISABLED')
        unsubscribe = sdk.onInternalDiagnosticEvent(
          (event, metadata) => {
            if (!metadata.trusted) return
            try {
              const normalized = adapter.normalize(event)
              if (normalized && !queue?.enqueue(normalized)) warn()
            } catch {
              try {
                queue?.recordLoss()
              } catch {
                /* Storage failure must not escape into the host. */
              }
              warn()
            }
          },
          { include: ['run.started', 'run.completed'] },
        )
        stopped = false
        timer = setInterval(flush, 30_000)
        timer.unref()
        flush()
      } catch {
        unsubscribe?.()
        unsubscribe = undefined
        queue?.close()
        queue = undefined
        warn()
      }
    },
    async stop() {
      stopped = true
      if (timer) clearInterval(timer)
      unsubscribe?.()
      unsubscribe = undefined
      await flight
      // Queue is durable. Only an already-running, time-bounded upload is awaited.
      queue?.close()
      queue = undefined
    },
  })
}

export default {
  id: 'work-address-agent-tracker',
  name: 'Work Address agent tracker',
  description: 'Passive run telemetry with a durable local queue (prototype).',
  register,
}
