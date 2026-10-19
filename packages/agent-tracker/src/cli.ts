#!/usr/bin/env node
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { collectCodexStream } from './stream.js'
import { readInput } from './input.js'
import { startUploader, uploadTrigger } from './upload.js'
import {
  captureHook,
  isHookProduct,
  serverAdapters,
  CodexExecAdapter,
  emitEvent,
} from './adapters.js'
import {
  EventQueue,
  readProcessScope,
  setup,
  stateDirectory,
  sync,
  type CollectorConfig,
} from './index.js'

/** Drain within the hook's budget; whatever remains goes to the detached uploader. */
async function flush(
  queue: EventQueue,
  config: CollectorConfig,
  budgetMs: number,
): Promise<void> {
  const deadline = Date.now() + budgetMs
  while (Date.now() < deadline) {
    const result = await sync(queue, config, fetch, deadline - Date.now())
    if (result.state !== 'uploaded' || result.sent === 0) return
  }
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2)
  const directory = stateDirectory()
  if (command === 'setup') {
    if (args.length !== 2 && args.length !== 3) throw new Error('USAGE')
    // Pipe a secret on stdin; never put it in shell history or process arguments.
    const credential = (await readInput(1024, 30_000)).trim()
    setup(directory, args[0], args[1], credential, args[2])
    console.log('Collector configured. Credentials were not printed.')
    return
  }
  if (command === 'adapters') {
    console.log(JSON.stringify(serverAdapters, null, 2))
    return
  }
  if (command === 'stream') {
    const complete = await collectCodexStream(
      process.stdin,
      () => {
        if (
          args.length !== 1 ||
          args[0] !== 'codex' ||
          process.env.WORK_ADDRESS_EXPERIMENTAL_ADAPTERS !== '1'
        )
          throw new Error('STREAM_CONFIGURATION')
        const scoped = readProcessScope(directory)
        const config = scoped.config
        const adapter = new CodexExecAdapter(config, randomUUID(), {
          agent: scoped.agent,
          runtimeVersion:
            process.env.WORK_ADDRESS_RUNTIME_VERSION ?? 'unqualified',
        })
        return { adapter, queue: new EventQueue(scoped.directory, config) }
      },
      () =>
        console.error(
          'Collector unavailable or incomplete; draining agent output until it finishes.',
        ),
    )
    if (!complete) process.exitCode = 1
    return
  }
  if (command === 'hook' || command === 'emit') {
    if (
      command !== 'emit' &&
      process.env.WORK_ADDRESS_EXPERIMENTAL_ADAPTERS !== '1'
    )
      throw new Error('EXPERIMENTAL_ADAPTER_DISABLED')
    const scoped = readProcessScope(directory)
    const config = scoped.config
    const queue = new EventQueue(scoped.directory, config)
    try {
      const options = {
        agent: scoped.agent,
        runtimeVersion:
          process.env.WORK_ADDRESS_RUNTIME_VERSION ?? 'unqualified',
      }
      if (command === 'hook') {
        if (args.length !== 1 || !isHookProduct(args[0]))
          throw new Error('UNKNOWN_ADAPTER')
        const input = JSON.parse(await readInput())
        captureHook(queue, config, args[0], input, options)
        const trigger = uploadTrigger(input?.hook_event_name)
        try {
          if (trigger === 'flush') await flush(queue, config, 8_000)
          if (trigger !== 'none' && queue.status().queued)
            startUploader(fileURLToPath(import.meta.url))
        } catch {
          // Delivery is retried by the next hook or `sync`; it never counts as
          // capture loss and never fails the agent's hook.
        }
        console.log('{}') // Neutral valid JSON, including Codex Stop's output contract.
      } else if (command === 'emit') {
        if (args.length) throw new Error('USAGE')
        if (!emitEvent(queue, JSON.parse(await readInput(16 * 1024))))
          throw new Error('QUEUE_FULL')
      }
    } catch (error) {
      queue.recordLoss()
      throw error
    } finally {
      queue.close()
    }
    return
  }
  if (command !== 'status' && command !== 'sync') {
    console.log(
      'agent-tracker setup <events-endpoint> <project-uuid> [source-instance-uuid]  (credential on stdin)\nagent-tracker adapters\nagent-tracker hook <product>\nagent-tracker stream codex\nagent-tracker emit\nagent-tracker status\nagent-tracker sync\nSet WORK_ADDRESS_STATE_DIR for a dedicated collector identity.',
    )
    if (command && command !== '--help') process.exitCode = 1
    return
  }
  if (args.length) throw new Error('USAGE')
  const scoped = readProcessScope(directory)
  const config = scoped.config
  const queue = new EventQueue(scoped.directory, config)
  try {
    if (command === 'sync') {
      // Finite drain, so a producer cannot keep this command alive indefinitely.
      for (let batches = 0; batches < 20; batches++) {
        const result = await sync(queue, config)
        if (result.state === 'retry') {
          process.exitCode = 1
          break
        }
        if (result.state !== 'uploaded' || result.sent === 0) break
      }
    }
    const status = queue.status()
    // 0 means all locally retained events have been acknowledged. Backoff, a
    // competing lease, rejections and the batch cap must not look like a drain.
    if (
      command === 'sync' &&
      (status.queued || status.rejected) &&
      !process.exitCode
    )
      process.exitCode = 2
    console.log(JSON.stringify(status))
  } finally {
    queue.close()
  }
}
main().catch(() => {
  console.error(
    'Collector command failed. Check configuration, private file permissions and command arguments. Existing queued data is preserved.',
  )
  if (process.argv[2] === 'hook') {
    console.log('{}')
    process.exitCode = 0
  } else process.exitCode = 1
})
