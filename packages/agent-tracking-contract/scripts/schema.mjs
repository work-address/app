import { mkdirSync, writeFileSync } from 'node:fs'
import { z } from 'zod'
import { agentEventV1Schema } from '../dist/index.js'
mkdirSync('schema', { recursive: true })
writeFileSync(
  'schema/agent-event-v1.json',
  JSON.stringify(z.toJSONSchema(agentEventV1Schema), null, 2) + '\n',
)
