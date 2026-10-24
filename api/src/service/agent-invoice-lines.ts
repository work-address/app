import { AgentAttachment, AgentSegment, WorkerAgent } from '@/model/agent'
import { IInvoiceLine } from '@/model/invoice'
import { Span, TimeSpans } from '@/service/time-spans'

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
    const own = TimeSpans.union(human.map((t): Span => [+t.fromAt, +t.toAt]))
    const byAgent = new Map<string, InvoiceableRun[]>()
    for (const run of runs)
      byAgent.set(run.agentId, [...(byAgent.get(run.agentId) ?? []), run])
    return [...byAgent].map(([agentId, agentRuns]): IInvoiceLine => {
      const attachment = attachments.find(
        (a) => a.agentId === agentId && a.workerId === workerId,
      )
      if (!attachment) throw new Error('AGENT_NOT_ATTACHED')
      const state = (name: AgentSegment['state']) =>
        TimeSpans.union(
          agentRuns.flatMap((run) =>
            run.segments
              .filter((segment) => segment.state === name)
              .map((s): Span => [Date.parse(s.fromAt), Date.parse(s.toAt)]),
          ),
        )
      const running = state('running')
      const wait = state('human_wait')
      const unknown = state('unknown')
      const billed = TimeSpans.union([...running, ...wait, ...unknown])
      const minutes = TimeSpans.minutes(billed)
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
        assistedMinutes: TimeSpans.minutes(TimeSpans.intersect(billed, own)),
        waitMinutes: TimeSpans.minutes(
          TimeSpans.subtract(wait, TimeSpans.union([...running, ...unknown])),
        ),
        unclassifiedMinutes: TimeSpans.minutes(
          TimeSpans.subtract(unknown, TimeSpans.union([...running, ...wait])),
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
            minutesBefore: TimeSpans.minutes(
              TimeSpans.intersect(billed, [[0, Date.parse(change.at)]]),
            ),
          })),
      }
    })
  }
}
