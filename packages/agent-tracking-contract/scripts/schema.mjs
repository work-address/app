import { mkdirSync, writeFileSync } from 'node:fs'
import { z } from 'zod'
import { agentEventV1Schema } from '../dist/index.js'
mkdirSync('schema', { recursive: true })
writeFileSync(
  'schema/agent-event-v1.json',
  JSON.stringify(z.toJSONSchema(agentEventV1Schema), null, 2) + '\n',
)

// The website keeps a copy of this file; regenerate it with each change.
const support = await import('../dist/support.js')
writeFileSync(
  'schema/agent-support.json',
  JSON.stringify(
    {
      checkedOn: support.AGENT_SUPPORT_CHECKED_ON,
      agents: support.AGENT_SUPPORT,
    },
    null,
    2,
  ) + '\n',
)
