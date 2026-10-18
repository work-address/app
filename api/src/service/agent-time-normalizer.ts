import type { AgentEventV1 } from '@work-address/agent-tracking-contract'
import { AgentSegment } from '@/model/agent'

/** Pure replay projection. No current vendor version is qualified for running time. */
export class AgentTimeNormalizer {
  public static project(
    events: AgentEventV1[],
    mode: 'timer' | 'fixed',
    now = Date.now(),
  ) {
    // Sequences are meaningful only within one producer epoch. Different epochs
    // are ordered by source time; sequence numbers never compare across boots.
    const streams = new Map<string, AgentEventV1[]>()
    for (const event of events) {
      const group = streams.get(event.source.epoch) ?? []
      group.push(event)
      streams.set(event.source.epoch, group)
    }
    const ordered = [...streams.values()]
      .sort(
        (a, b) =>
          Math.min(...a.map((e) => Date.parse(e.occurredAt))) -
            Math.min(...b.map((e) => Date.parse(e.occurredAt))) ||
          a[0].source.epoch.localeCompare(b[0].source.epoch),
      )
      .flatMap((group) =>
        group.sort(
          (a, b) =>
            a.source.sequence - b.source.sequence ||
            a.eventId.localeCompare(b.eventId),
        ),
      )
    const start = ordered.find((e) => e.eventType === 'run.started')
    if (!start) return { code: 'MISSING_START' } as const
    if (
      new Set(
        ordered
          .filter((e) => e.eventType === 'run.started')
          .map((e) => e.occurredAt),
      ).size > 1
    )
      return { code: 'CONFLICTING_STARTS' } as const
    const terminals = ordered.filter((e) =>
      ['run.completed', 'run.failed', 'run.cancelled'].includes(e.eventType),
    )
    if (
      new Set(terminals.map((e) => `${e.eventType}:${e.occurredAt}`)).size > 1
    )
      return { code: 'CONFLICTING_TERMINALS' } as const
    const terminal = terminals[0]
    const fromAt = Date.parse(start.occurredAt)
    if (terminal && Date.parse(terminal.occurredAt) < fromAt)
      return { code: 'CLOCK_REVERSAL' } as const
    let cursor = fromAt
    let state: AgentSegment['state'] = 'unknown'
    const segments: AgentSegment[] = []
    for (const event of ordered) {
      const at = Date.parse(event.occurredAt)
      // Replayed source terminals outrank provisional collector observations and
      // timer gates that were emitted before the source's stop was discovered.
      if (terminal && at > Date.parse(terminal.occurredAt)) continue
      if (at < cursor) return { code: 'CLOCK_REVERSAL' } as const
      if (at > cursor) {
        const last = segments[segments.length - 1]
        if (last?.state === state) last.toAt = new Date(at).toISOString()
        else
          segments.push({
            fromAt: new Date(cursor).toISOString(),
            toAt: new Date(at).toISOString(),
            state,
            evidence:
              state === 'untracked' ? 'timer_gate' : 'unqualified_adapter',
          })
        cursor = at
      }
      if (mode === 'timer' && event.eventType === 'tracking.paused')
        state = 'untracked'
      if (mode === 'timer' && event.eventType === 'tracking.resumed')
        state = 'unknown'
    }
    if (segments.length > 10000) return { code: 'SEGMENT_LIMIT' } as const
    return {
      start,
      fromAt: new Date(fromAt),
      toAt: new Date(cursor),
      segments,
      status: terminal ? terminal.eventType.slice(4) : 'unknown',
      provisional: !terminal || now - cursor < 60000,
    }
  }
}
