import { execFile } from 'node:child_process'

// OpenCode uses Bun. SQLite belongs to the separate Node collector, never this host.
export const WorkAddress = async () => {
  let warned = false
  return {
    event: async ({ event }) => {
      if (process.env.WORK_ADDRESS_EXPERIMENTAL_ADAPTERS !== '1') return
      const p = event?.properties
      const name =
        event?.type === 'session.status'
          ? p?.status?.type
          : event?.type === 'session.idle'
            ? 'idle'
            : event?.type === 'session.error'
              ? 'error'
              : undefined
      if (
        !['busy', 'idle', 'error'].includes(name) ||
        typeof p?.sessionID !== 'string' ||
        p.sessionID.length > 4096
      )
        return
      try {
        await new Promise((resolve) => {
          const child = execFile(
            process.env.WORK_ADDRESS_COLLECTOR_BIN || 'agent-tracker',
            ['hook', 'opencode'],
            {
              timeout: 1000,
              maxBuffer: 4096,
              env: { ...process.env, NODE_NO_WARNINGS: '1' },
            },
            (error, _stdout, stderr) => {
              if ((error || stderr) && !warned) {
                console.warn(
                  'Work Address: observer delivery unavailable; timing may be incomplete.',
                )
                warned = true
              }
              resolve()
            },
          )
          child.stdin.on('error', () => {})
          child.stdin.end(
            JSON.stringify({ hook_event_name: name, session_id: p.sessionID }),
          )
        })
      } catch {
        if (!warned)
          console.warn(
            'Work Address: observer delivery unavailable; timing may be incomplete.',
          )
        warned = true
      }
    },
  }
}
