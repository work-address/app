import type { AgentEventV1 } from '@work-address/agent-tracking-contract'

export class AgentIdentity {
  /** UUID spelling is not identity; provider-defined opaque IDs remain case-sensitive. */
  public static event(event: AgentEventV1): AgentEventV1 {
    return {
      ...event,
      eventId: event.eventId.toLowerCase(),
      projectId: event.projectId.toLowerCase(),
      source: {
        ...event.source,
        instanceId: event.source.instanceId.toLowerCase(),
        epoch: event.source.epoch.toLowerCase(),
      },
    }
  }
}
