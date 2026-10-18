import { z } from 'zod'

const id = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9._:-]+$/)
const integer = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
const timestamp = z.iso.datetime()
const base = {
  schemaVersion: z.literal(1),
  eventId: z.uuid(),
  source: z.strictObject({
    product: id,
    surface: id,
    instanceId: z.uuid(),
    agent: id.optional(),
    adapterVersion: id,
    runtimeVersion: id,
    epoch: z.uuid(),
    sequence: integer,
  }),
  projectId: z.uuid(),
  sessionId: id,
  runId: id,
  agentId: id,
  occurredAt: timestamp,
  observedAt: timestamp,
  clock: z.strictObject({ basis: z.enum(['source_wall', 'collector_wall']) }),
  capabilities: z.strictObject({
    runBoundaries: z.boolean(),
    externalWaits: z.enum(['none', 'partial', 'complete']),
    replay: z.boolean(),
  }),
}

/** Strict lifecycle, observation and desktop timer-gate events. */
export const agentEventV1Schema = z.discriminatedUnion('eventType', [
  z.strictObject({ ...base, eventType: z.literal('run.started') }),
  z.strictObject({
    ...base,
    eventType: z.literal('tracking.paused'),
    reason: z.enum(['stopped', 'idle', 'suspended', 'switched']),
  }),
  z.strictObject({
    ...base,
    eventType: z.literal('tracking.resumed'),
    reason: z.enum(['started', 'switched']),
  }),
  z.strictObject({
    ...base,
    eventType: z.literal('run.observed'),
    observedState: z.enum(['running', 'unknown']),
    evidenceKind: z.enum(['runtime_state', 'lifecycle']),
  }),
  z.strictObject({
    ...base,
    eventType: z.literal('run.completed'),
    sourceDurationMs: integer.optional(),
  }),
  z.strictObject({
    ...base,
    eventType: z.literal('run.failed'),
    sourceDurationMs: integer.optional(),
  }),
  z.strictObject({
    ...base,
    eventType: z.literal('run.cancelled'),
    sourceDurationMs: integer.optional(),
  }),
])
export type AgentEventV1 = z.infer<typeof agentEventV1Schema>
export const MAX_EVENT_BYTES = 16 * 1024
export const MAX_BATCH_BYTES = 1024 * 1024
export const MAX_BATCH_EVENTS = 100

export const collectorHealthV1Schema = z.strictObject({
  queued: integer,
  rejected: integer,
  lost: integer,
  heldRuns: integer,
  lastSuccessfulUploadAt: timestamp.optional(),
})
export type CollectorHealthV1 = z.infer<typeof collectorHealthV1Schema>
export const ingestBatchSchema = z
  .strictObject({
    events: z.array(agentEventV1Schema).max(MAX_BATCH_EVENTS),
    health: collectorHealthV1Schema.optional(),
  })
  .refine((batch) => batch.events.length > 0 || batch.health !== undefined)

export function parseEvent(value: unknown): AgentEventV1 {
  const event = agentEventV1Schema.parse(value)
  if (
    new TextEncoder().encode(JSON.stringify(event)).length > MAX_EVENT_BYTES
  ) {
    throw new Error('EVENT_TOO_LARGE')
  }
  return event
}

export const ingestResponseSchema = z.strictObject({
  results: z
    .array(
      z.discriminatedUnion('status', [
        z.strictObject({ eventId: z.uuid(), status: z.literal('accepted') }),
        z.strictObject({ eventId: z.uuid(), status: z.literal('duplicate') }),
        z.strictObject({
          eventId: z.uuid(),
          status: z.literal('rejected'),
          code: z.string().regex(/^[A-Z_]{1,100}$/),
        }),
      ]),
    )
    .max(MAX_BATCH_EVENTS),
})
export type IngestResult = z.infer<
  typeof ingestResponseSchema
>['results'][number]
