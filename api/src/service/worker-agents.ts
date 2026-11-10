import {
  AGENT_PRODUCT_NAMES,
  AgentAttachment,
  WorkerAgent,
} from '@/model/agent'

/** Why a change to a worker's agents or attachments is refused. */
export type WorkerAgentsRefusal =
  | 'DUPLICATE_BINDING'
  | 'NOT_FOUND'
  | 'AGENT_LIMIT'
  | 'PRODUCT_IMMUTABLE'
  | 'SLUG_IN_USE'
  | 'BINDING_IN_USE'
  | 'NOT_OWN_AGENT'

export type Refused = { refused: WorkerAgentsRefusal }

/** What a worker asks an agent to be; the rest is the module's to fill in. */
export interface AgentDraft {
  id?: string
  name: string
  slug: string
  product: string
  isDefault: boolean
  bindings: string[]
}

const MAX_AGENTS = 100

/**
 * Every rule about a worker's agents and where they are attached
 * (docs/worker-agents.md): which agent a run goes to, whether an attachment
 * still counts, who may see it, and what the two lists become when something
 * changes. Pure: `AgentRepository` and `AgentRunRecord` lock and persist the
 * lists, and nothing else decides what is in them. An attachment is always
 * found by its agent and its worker together.
 */
export class WorkerAgents {
  /** The attachment of this worker's agent, detached or not. */
  public static attachmentOf(
    attachments: AgentAttachment[],
    workerId: string,
    agentId: string,
  ): AgentAttachment | undefined {
    return attachments.find(
      (a) => a.agentId === agentId && a.workerId === workerId,
    )
  }

  /** New runs land only on an agent that is still the worker's and still attached. */
  public static acceptsRuns(
    agents: WorkerAgent[],
    attachments: AgentAttachment[],
    workerId: string,
    agentId: string,
  ): boolean {
    const attachment = this.attachmentOf(attachments, workerId, agentId)

    return (
      agents.some((a) => a.id === agentId && !a.removedAt) &&
      attachment !== undefined &&
      !attachment.detachedAt
    )
  }

  /**
   * Past runs stay billable at the attachment's last rate once the agent is
   * detached or removed. What was never attached bills nothing.
   */
  public static billsPastRuns(
    attachments: AgentAttachment[],
    workerId: string,
    agentId: string,
  ): boolean {
    return this.attachmentOf(attachments, workerId, agentId) !== undefined
  }

  /** The worker's agents the Team shows on a project: those that accept runs. */
  public static onTeam(
    agents: WorkerAgent[],
    attachments: AgentAttachment[],
    workerId: string,
  ): { agent: WorkerAgent; attachment: AgentAttachment }[] {
    return attachments.flatMap((attachment) => {
      const agent = agents.find((a) => a.id === attachment.agentId)

      return agent &&
        attachment.workerId === workerId &&
        this.acceptsRuns(agents, attachments, workerId, agent.id)
        ? [{ agent, attachment }]
        : []
    })
  }

  /** The owner sees every attachment, a worker their own, anyone else none. */
  public static visibleTo(
    attachments: AgentAttachment[],
    reader: { id: string; isOwner: boolean; canWork: boolean },
  ): AgentAttachment[] {
    return attachments.filter(
      (a) => reader.isOwner || (reader.canWork && a.workerId === reader.id),
    )
  }

  /**
   * The agent a run goes to. A run stays with the agent its first event went
   * to; otherwise the handle it names, the agent bound to its machine, then
   * the product's default. Never a removed agent, and a named handle that
   * matches nothing falls back to nothing.
   */
  public static assign(
    agents: WorkerAgent[],
    run: {
      product: string
      /** The agent an earlier event of this run was pinned to, if there was one. */
      pinnedAgentId?: string
      /** `WORK_ADDRESS_AGENT`, when the collector sent one. */
      handle?: string
      instanceId: string
    },
  ): WorkerAgent | undefined {
    const live = agents.filter((a) => !a.removedAt && a.product === run.product)

    if (run.pinnedAgentId !== undefined)
      return live.find((a) => a.id === run.pinnedAgentId)
    if (run.handle) return live.find((a) => a.slug === run.handle)

    return (
      live.find((a) =>
        a.bindings.some(
          (id) => id.toLowerCase() === run.instanceId.toLowerCase(),
        ),
      ) ?? live.find((a) => a.isDefault)
    )
  }

  /**
   * What unnamed laptop runs of these products set up for a worker: a default
   * agent for a product they never had an agent for, and each run's agent
   * attached at 0/hour where the worker never had it attached. Their own
   * choices stand: a removed agent is not recreated and a detached one is not
   * reattached. Whoever takes locks asks `addsAgents` and `attaches`; whoever
   * writes takes the lists. Pass no attachments to ask about agents alone.
   */
  public static provision(input: {
    agents: WorkerAgent[]
    attachments: AgentAttachment[]
    workerId: string
    instanceId: string
    products: string[]
    at: string
    newId: () => string
  }): {
    agents: WorkerAgent[]
    addsAgents: boolean
    attachments: AgentAttachment[]
    attaches: boolean
  } {
    const { workerId, instanceId, at } = input
    const products = [...new Set(input.products)]
    const agents = [...input.agents]

    for (const product of products) {
      if (!(product in AGENT_PRODUCT_NAMES)) continue
      if (agents.some((a) => a.product === product)) continue
      let slug = product
      for (let n = 2; agents.some((a) => a.slug === slug); n++)
        slug = `${product}-${n}`
      agents.push({
        id: input.newId(),
        name: AGENT_PRODUCT_NAMES[product as keyof typeof AGENT_PRODUCT_NAMES],
        slug,
        product,
        isDefault: true,
        bindings: [],
        createdAt: at,
        removedAt: null,
      })
    }

    const attachments = [...input.attachments]

    for (const product of products) {
      const agent = this.assign(agents, { product, instanceId })
      if (!agent || this.attachmentOf(attachments, workerId, agent.id)) continue
      attachments.push(this.newAttachment(workerId, agent.id, at))
    }

    return {
      agents,
      addsAgents: agents.length > input.agents.length,
      attachments,
      attaches: attachments.length > input.attachments.length,
    }
  }

  /**
   * A worker adds an agent or edits one of theirs. A product keeps exactly one
   * default: its first agent, or the one that asks, which takes it from the
   * last. A handle stays taken once used, a removed agent's included.
   */
  public static save(
    agents: WorkerAgent[],
    draft: AgentDraft,
    create: boolean,
    stamp: { at: string; newId: () => string },
  ): { agents: WorkerAgent[]; agent: WorkerAgent } | Refused {
    const data = {
      ...draft,
      id: draft.id?.toLowerCase(),
      bindings: draft.bindings.map((id) => id.toLowerCase()),
    }

    if (new Set(data.bindings).size !== data.bindings.length)
      return { refused: 'DUPLICATE_BINDING' }
    const prior = create
      ? undefined
      : agents.find((a) => a.id === data.id && !a.removedAt)
    if (!create && !prior) return { refused: 'NOT_FOUND' }
    if (create && agents.length >= MAX_AGENTS) return { refused: 'AGENT_LIMIT' }
    if (prior && prior.product !== data.product)
      return { refused: 'PRODUCT_IMMUTABLE' }
    if (agents.some((a) => a.id !== prior?.id && a.slug === data.slug))
      return { refused: 'SLUG_IN_USE' }
    const peer = (a: WorkerAgent) =>
      !a.removedAt && a.id !== prior?.id && a.product === data.product
    if (
      agents.some(
        (a) =>
          peer(a) &&
          a.bindings.some((b) => data.bindings.includes(b.toLowerCase())),
      )
    )
      return { refused: 'BINDING_IN_USE' }

    const peers = agents.filter(peer)
    const agent: WorkerAgent = {
      ...data,
      id: prior?.id ?? stamp.newId(),
      isDefault: data.isDefault || !peers.some((a) => a.isDefault),
      createdAt: prior?.createdAt ?? stamp.at,
      removedAt: null,
    }

    return {
      agent,
      agents: [
        ...agents
          .filter((a) => a.id !== agent.id)
          .map((a) =>
            agent.isDefault && peer(a) ? { ...a, isDefault: false } : a,
          ),
        agent,
      ],
    }
  }

  /**
   * A worker removes an agent: it is kept, so runs and invoice lines keep a
   * name, but it gives up its bindings and its place as default, which the
   * product's next agent takes. Removing it twice changes nothing.
   */
  public static remove(
    agents: WorkerAgent[],
    agentId: string,
    at: string,
  ): { agents: WorkerAgent[]; changed: boolean } | Refused {
    const id = agentId.toLowerCase()
    const agent = agents.find((a) => a.id === id)

    if (!agent) return { refused: 'NOT_FOUND' }
    if (agent.removedAt) return { agents, changed: false }
    const next = agents.map((a) =>
      a.id === id ? { ...a, removedAt: at, isDefault: false, bindings: [] } : a,
    )
    const peers = next.filter(
      (a) => !a.removedAt && a.product === agent.product,
    )
    const heir =
      peers.length && !peers.some((a) => a.isDefault) ? peers[0] : undefined

    return {
      changed: true,
      agents: next.map((a) => (a === heir ? { ...a, isDefault: true } : a)),
    }
  }

  /**
   * A worker attaches one of their agents to a project, sets its rate, or
   * (with no rate) detaches it. Every rate change is logged for the owner.
   * Setting a rate on a detached agent attaches it again.
   */
  public static attach(
    agents: WorkerAgent[],
    attachments: AgentAttachment[],
    change: {
      workerId: string
      agentId: string
      rateHourCents: number | null
      at: string
    },
  ): { attachments: AgentAttachment[]; attachment: AgentAttachment } | Refused {
    const { workerId, rateHourCents, at } = change
    const agentId = change.agentId.toLowerCase()

    if (!agents.some((a) => a.id === agentId && !a.removedAt))
      return { refused: 'NOT_OWN_AGENT' }
    const prior = this.attachmentOf(attachments, workerId, agentId)
    if (!prior && rateHourCents === null) return { refused: 'NOT_FOUND' }
    const from = prior ?? this.newAttachment(workerId, agentId, at)
    const attachment: AgentAttachment =
      rateHourCents === null
        ? { ...from, detachedAt: at }
        : {
            ...from,
            rateHourCents,
            rateChanges:
              from.rateHourCents === rateHourCents
                ? from.rateChanges
                : [
                    ...from.rateChanges,
                    {
                      at,
                      fromCents: from.rateHourCents,
                      toCents: rateHourCents,
                      changedBy: workerId,
                    },
                  ],
            detachedAt: null,
          }

    return {
      attachment,
      attachments: prior
        ? attachments.map((a) => (a === prior ? attachment : a))
        : [...attachments, attachment],
    }
  }

  /** Until the worker sets a rate, an attached agent's time costs nothing. */
  private static newAttachment(
    workerId: string,
    agentId: string,
    at: string,
  ): AgentAttachment {
    return {
      agentId,
      workerId,
      rateHourCents: 0,
      rateChanges: [],
      attachedAt: at,
      detachedAt: null,
    }
  }
}
