import { AgentAttachment, AgentSegment, WorkerAgent } from '@/model/agent'
import { IInvoiceLine } from '@/model/invoice'

type Span = [number, number]

export interface InvoiceableRun {
  agentId: string
  product: string
  fromAt: Date
  segments: AgentSegment[]
}

/**
 * One invoice line per agent: the union of its billable segments across runs,
 * so overlapping runs of one agent bill once. `untracked` (timer off) counts
 * toward nothing. Priced once per line at the attachment's current rate.
 */
export class AgentInvoiceLines {
  public static build(
    runs: InvoiceableRun[],
    agents: WorkerAgent[],
    attachments: AgentAttachment[],
    workerId: string,
    human: { fromAt: Date; toAt: Date }[],
    createdAt: Date,
  ): IInvoiceLine[] {
    const own = this.union(human.map((t): Span => [+t.fromAt, +t.toAt]))
    const byAgent = new Map<string, InvoiceableRun[]>()
    for (const run of runs)
      byAgent.set(run.agentId, [...(byAgent.get(run.agentId) ?? []), run])
    return [...byAgent].map(([agentId, agentRuns]): IInvoiceLine => {
      const attachment = attachments.find(
        (a) => a.agentId === agentId && a.workerId === workerId,
      )
      if (!attachment) throw new Error('AGENT_NOT_ATTACHED')
      const state = (name: AgentSegment['state']) =>
        this.union(
          agentRuns.flatMap((run) =>
            run.segments
              .filter((segment) => segment.state === name)
              .map((s): Span => [Date.parse(s.fromAt), Date.parse(s.toAt)]),
          ),
        )
      const running = state('running')
      const wait = state('human_wait')
      const unknown = state('unknown')
      const billed = this.union([...running, ...wait, ...unknown])
      const minutes = this.minutes(billed)
      const earliest = Math.min(...agentRuns.map((run) => +run.fromAt))
      const rateHourCents = attachment.rateHourCents
      return {
        kind: 'agent',
        agentId,
        name:
          agents.find((agent) => agent.id === agentId)?.name ??
          agentRuns[0].product,
        basis: 'active',
        minutes,
        assistedMinutes: this.minutes(this.intersect(billed, own)),
        waitMinutes: this.minutes(
          this.subtract(wait, this.union([...running, ...unknown])),
        ),
        unclassifiedMinutes: this.minutes(
          this.subtract(unknown, this.union([...running, ...wait])),
        ),
        rateHourCents,
        amountCents: Math.round((minutes * rateHourCents) / 60),
        rateChanges: attachment.rateChanges
          .filter(
            (change) =>
              Date.parse(change.at) >= earliest &&
              Date.parse(change.at) <= +createdAt,
          )
          .map((change) => ({
            at: change.at,
            fromCents: change.fromCents,
            toCents: change.toCents,
            minutesBefore: this.minutes(
              this.intersect(billed, [[0, Date.parse(change.at)]]),
            ),
          })),
      }
    })
  }

  private static minutes(spans: Span[]): number {
    return spans.reduce((sum, [start, end]) => sum + end - start, 0) / 60000
  }

  /** Sorted, disjoint, half-open intervals. */
  private static union(spans: Span[]): Span[] {
    const merged: Span[] = []
    for (const [start, end] of spans
      .filter(([start, end]) => end > start)
      .sort((a, b) => a[0] - b[0])) {
      const last = merged[merged.length - 1]
      if (last && start <= last[1]) last[1] = Math.max(last[1], end)
      else merged.push([start, end])
    }
    return merged
  }

  private static intersect(a: Span[], b: Span[]): Span[] {
    const out: Span[] = []
    let i = 0
    let j = 0
    while (i < a.length && j < b.length) {
      const start = Math.max(a[i][0], b[j][0])
      const end = Math.min(a[i][1], b[j][1])
      if (start < end) out.push([start, end])
      if (a[i][1] < b[j][1]) i++
      else j++
    }
    return out
  }

  private static subtract(a: Span[], b: Span[]): Span[] {
    const out: Span[] = []
    for (const [start, end] of a) {
      let cursor = start
      for (const [s, e] of b) {
        if (e <= cursor || s >= end) continue
        if (s > cursor) out.push([cursor, s])
        cursor = e
        if (cursor >= end) break
      }
      if (cursor < end) out.push([cursor, end])
    }
    return out
  }
}
