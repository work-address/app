import { expect } from 'chai'
import { AgentAttachment, WorkerAgent } from '@/model/agent'
import { WorkerAgents } from '@/service/worker-agents'

const WORKER = 'worker-1'
const OTHER = 'worker-2'
const MACHINE = '4c8b5f0e-6a53-4f0b-9c1e-2f1d5a7e9b10'
const AT = '2026-11-10T09:00:00.000Z'

const agent = (id: string, over: Partial<WorkerAgent> = {}): WorkerAgent => ({
  id,
  name: id,
  slug: id,
  product: 'codex',
  isDefault: false,
  bindings: [],
  createdAt: '2026-10-01T00:00:00.000Z',
  removedAt: null,
  ...over,
})

const attachment = (
  agentId: string,
  over: Partial<AgentAttachment> = {},
): AgentAttachment => ({
  agentId,
  workerId: WORKER,
  rateHourCents: 500,
  rateChanges: [],
  attachedAt: '2026-10-02T00:00:00.000Z',
  detachedAt: null,
  ...over,
})

const ids = () => {
  let n = 0

  return () => `new-${++n}`
}

describe('WorkerAgents', () => {
  describe('the three questions about an attachment', () => {
    const cases: {
      name: string
      agents: WorkerAgent[]
      attachments: AgentAttachment[]
      accepts: boolean
      bills: boolean
    }[] = [
      {
        name: 'attached',
        agents: [agent('a')],
        attachments: [attachment('a')],
        accepts: true,
        bills: true,
      },
      {
        name: 'detached',
        agents: [agent('a')],
        attachments: [attachment('a', { detachedAt: AT })],
        accepts: false,
        bills: true,
      },
      {
        name: 'agent removed, attachment left',
        agents: [agent('a', { removedAt: AT })],
        attachments: [attachment('a')],
        accepts: false,
        bills: true,
      },
      {
        name: 'never attached',
        agents: [agent('a')],
        attachments: [],
        accepts: false,
        bills: false,
      },
      {
        name: "another worker's attachment of the same agent id",
        agents: [agent('a')],
        attachments: [attachment('a', { workerId: OTHER })],
        accepts: false,
        bills: false,
      },
    ]

    for (const c of cases)
      it(`${c.name}: accepts new runs ${c.accepts}, bills past runs ${c.bills}, on the Team ${c.accepts}`, () => {
        expect(
          WorkerAgents.acceptsRuns(c.agents, c.attachments, WORKER, 'a'),
        ).to.equal(c.accepts)
        expect(WorkerAgents.billsPastRuns(c.attachments, WORKER, 'a')).to.equal(
          c.bills,
        )
        expect(
          WorkerAgents.onTeam(c.agents, c.attachments, WORKER).map(
            (row) => row.agent.id,
          ),
        ).to.deep.equal(c.accepts ? ['a'] : [])
      })

    it('the Team row carries the attachment, so its rate', () => {
      const [row] = WorkerAgents.onTeam(
        [agent('a')],
        [attachment('a', { rateHourCents: 1250 })],
        WORKER,
      )

      expect(row.attachment.rateHourCents).to.equal(1250)
    })
  })

  describe('who may see an attachment', () => {
    const attachments = [attachment('a'), attachment('b', { workerId: OTHER })]
    const seen = (reader: { id: string; isOwner: boolean; canWork: boolean }) =>
      WorkerAgents.visibleTo(attachments, reader).map((a) => a.agentId)

    it('the owner sees all, a worker their own, anyone else none', () => {
      expect(seen({ id: 'owner', isOwner: true, canWork: true })).to.deep.equal(
        ['a', 'b'],
      )
      expect(seen({ id: WORKER, isOwner: false, canWork: true })).to.deep.equal(
        ['a'],
      )
      expect(
        seen({ id: WORKER, isOwner: false, canWork: false }),
      ).to.deep.equal([])
    })
  })

  describe('which agent a run goes to', () => {
    const bound = agent('bound', { bindings: [MACHINE.toUpperCase()] })
    const fallback = agent('default', { isDefault: true })
    const named = agent('named', { slug: 'research' })
    const agents = [fallback, bound, named]
    const to = (
      run: Partial<Parameters<typeof WorkerAgents.assign>[1]>,
      list = agents,
    ) =>
      WorkerAgents.assign(list, {
        product: 'codex',
        instanceId: MACHINE,
        ...run,
      })?.id

    it('the pinned agent first, whatever the event now says', () => {
      expect(to({ pinnedAgentId: 'default', handle: 'research' })).to.equal(
        'default',
      )
    })

    it('then the handle, then the machine binding, then the default', () => {
      expect(to({ handle: 'research' })).to.equal('named')
      expect(to({})).to.equal('bound')
      expect(to({ instanceId: 'another-machine' })).to.equal('default')
    })

    it('a handle that names nothing gets nothing, not the default', () => {
      expect(to({ handle: 'nobody' })).to.equal(undefined)
    })

    it('never a removed agent, pinned or not', () => {
      const gone = [agent('default', { isDefault: true, removedAt: AT })]

      expect(to({}, gone)).to.equal(undefined)
      expect(to({ pinnedAgentId: 'default' }, gone)).to.equal(undefined)
    })

    it("never another product's agent", () => {
      expect(to({ product: 'claude-code' })).to.equal(undefined)
    })

    it('nothing when the product has no default and no binding matches', () => {
      expect(to({ instanceId: 'another-machine' }, [bound])).to.equal(undefined)
    })
  })

  describe('what unnamed laptop runs provision', () => {
    const provision = (
      over: Partial<Parameters<typeof WorkerAgents.provision>[0]> = {},
    ) =>
      WorkerAgents.provision({
        agents: [],
        attachments: [],
        workerId: WORKER,
        instanceId: MACHINE,
        products: ['codex'],
        at: AT,
        newId: ids(),
        ...over,
      })

    it('a default agent for a product never had, attached at 0', () => {
      const plan = provision()

      expect(plan.addsAgents).to.equal(true)
      expect(plan.attaches).to.equal(true)
      expect(plan.agents).to.deep.equal([
        {
          id: 'new-1',
          name: 'Codex',
          slug: 'codex',
          product: 'codex',
          isDefault: true,
          bindings: [],
          createdAt: AT,
          removedAt: null,
        },
      ])
      expect(plan.attachments).to.deep.equal([
        {
          agentId: 'new-1',
          workerId: WORKER,
          rateHourCents: 0,
          rateChanges: [],
          attachedAt: AT,
          detachedAt: null,
        },
      ])
    })

    it('numbers the handle when another agent holds the product name', () => {
      const plan = provision({
        agents: [agent('x', { product: 'claude-code', slug: 'codex' })],
      })

      expect(plan.agents[1].slug).to.equal('codex-2')
    })

    it('attaches the existing default and adds no agent', () => {
      const plan = provision({ agents: [agent('a', { isDefault: true })] })

      expect(plan.addsAgents).to.equal(false)
      expect(plan.attachments.map((a) => a.agentId)).to.deep.equal(['a'])
    })

    it("attaches the machine's agent rather than the default", () => {
      const plan = provision({
        agents: [
          agent('a', { isDefault: true }),
          agent('b', { bindings: [MACHINE] }),
        ],
      })

      expect(plan.attachments.map((a) => a.agentId)).to.deep.equal(['b'])
    })

    it('does not recreate a removed agent or attach anything for it', () => {
      const plan = provision({
        agents: [agent('a', { isDefault: false, removedAt: AT })],
      })

      expect(plan.addsAgents).to.equal(false)
      expect(plan.attaches).to.equal(false)
    })

    it('does not reattach a detached agent', () => {
      const detached = attachment('a', { detachedAt: AT })
      const plan = provision({
        agents: [agent('a', { isDefault: true })],
        attachments: [detached],
      })

      expect(plan.attaches).to.equal(false)
      expect(plan.attachments).to.deep.equal([detached])
    })

    it('sets up nothing for a product it does not know', () => {
      const plan = provision({ products: ['not-a-product'] })

      expect(plan.addsAgents).to.equal(false)
      expect(plan.attaches).to.equal(false)
    })

    it('one agent and one attachment per product, however many runs', () => {
      const plan = provision({ products: ['codex', 'codex', 'claude-code'] })

      expect(plan.agents.map((a) => a.product)).to.deep.equal([
        'codex',
        'claude-code',
      ])
      expect(plan.attachments).to.have.length(2)
    })

    it('leaves the lists it was given as they were', () => {
      const agents: WorkerAgent[] = []
      const attachments: AgentAttachment[] = []

      provision({ agents, attachments })

      expect(agents).to.deep.equal([])
      expect(attachments).to.deep.equal([])
    })
  })

  describe('saving an agent', () => {
    const draft = (over = {}) => ({
      name: 'Build server',
      slug: 'build',
      product: 'codex',
      isDefault: false,
      bindings: [] as string[],
      ...over,
    })
    const save = (agents: WorkerAgent[], over = {}, create = true) =>
      WorkerAgents.save(agents, draft(over), create, { at: AT, newId: ids() })

    it("a product's first agent is its default whatever is asked", () => {
      const result = save([])

      expect(result).to.have.nested.property('agent.isDefault', true)
      expect(result).to.have.nested.property('agent.id', 'new-1')
      expect(result).to.have.nested.property('agent.createdAt', AT)
    })

    it('a second agent is not, unless it asks, and then it takes the place', () => {
      const first = agent('a', { isDefault: true })
      const quiet = save([first])
      const asking = save([first], { isDefault: true })

      expect(quiet).to.have.nested.property('agent.isDefault', false)
      expect(asking).to.have.nested.property('agent.isDefault', true)
      expect(
        'agents' in asking && asking.agents.find((a) => a.id === 'a'),
      ).to.include({ isDefault: false })
      expect(first.isDefault).to.equal(true)
    })

    it('lower-cases the machines it is bound to', () => {
      const result = save([], { bindings: [MACHINE.toUpperCase()] })

      expect(result).to.have.deep.nested.property('agent.bindings', [MACHINE])
    })

    it('an edit keeps the id and the day it was made', () => {
      const result = save(
        [agent('a', { isDefault: true })],
        { id: 'A', name: 'Renamed' },
        false,
      )

      expect(result).to.have.nested.property('agent.id', 'a')
      expect(result).to.have.nested.property('agent.name', 'Renamed')
      expect(result).to.have.nested.property(
        'agent.createdAt',
        '2026-10-01T00:00:00.000Z',
      )
      expect('agents' in result && result.agents).to.have.length(1)
    })

    const refusals: [string, WorkerAgent[], object, boolean, string][] = [
      [
        'the same machine twice',
        [],
        { bindings: [MACHINE, MACHINE.toUpperCase()] },
        true,
        'DUPLICATE_BINDING',
      ],
      ['an edit of nothing', [], { id: 'a' }, false, 'NOT_FOUND'],
      [
        'an edit of a removed agent',
        [agent('a', { removedAt: AT })],
        { id: 'a' },
        false,
        'NOT_FOUND',
      ],
      [
        'a hundred and first agent',
        Array.from({ length: 100 }, (_, i) => agent(`a${i}`)),
        {},
        true,
        'AGENT_LIMIT',
      ],
      [
        'a change of product',
        [agent('a')],
        { id: 'a', product: 'claude-code' },
        false,
        'PRODUCT_IMMUTABLE',
      ],
      [
        'a handle a removed agent still holds',
        [agent('a', { slug: 'build', removedAt: AT })],
        {},
        true,
        'SLUG_IN_USE',
      ],
      [
        'a machine another agent of the product is bound to',
        [agent('a', { bindings: [MACHINE] })],
        { bindings: [MACHINE] },
        true,
        'BINDING_IN_USE',
      ],
    ]

    for (const [name, agents, over, create, code] of refusals)
      it(`refuses ${name} with ${code}`, () => {
        expect(save(agents, over, create)).to.deep.equal({ refused: code })
      })

    it("a machine may be bound to another product's agent too", () => {
      const result = save(
        [agent('a', { product: 'claude-code', bindings: [MACHINE] })],
        { bindings: [MACHINE] },
      )

      expect(result).to.not.have.property('refused')
    })
  })

  describe('removing an agent', () => {
    it('keeps it, without its bindings or its place as default', () => {
      const result = WorkerAgents.remove(
        [agent('a', { isDefault: true, bindings: [MACHINE] }), agent('b')],
        'A',
        AT,
      )

      expect(result).to.deep.include({ changed: true })
      expect('agents' in result && result.agents).to.deep.equal([
        agent('a', { removedAt: AT }),
        agent('b', { isDefault: true }),
      ])
    })

    it('twice changes nothing', () => {
      const agents = [agent('a', { removedAt: '2026-11-01T00:00:00.000Z' })]

      expect(WorkerAgents.remove(agents, 'a', AT)).to.deep.equal({
        agents,
        changed: false,
      })
    })

    it('refuses an agent that is not there', () => {
      expect(WorkerAgents.remove([], 'a', AT)).to.deep.equal({
        refused: 'NOT_FOUND',
      })
    })
  })

  describe('attaching, setting a rate and detaching', () => {
    const change = (
      attachments: AgentAttachment[],
      rateHourCents: number | null,
      agents = [agent('a')],
    ) =>
      WorkerAgents.attach(agents, attachments, {
        workerId: WORKER,
        agentId: 'A',
        rateHourCents,
        at: AT,
      })

    it('attaches at the rate given, logged as a change from 0', () => {
      expect(change([], 1250)).to.have.deep.property('attachment', {
        agentId: 'a',
        workerId: WORKER,
        rateHourCents: 1250,
        rateChanges: [
          { at: AT, fromCents: 0, toCents: 1250, changedBy: WORKER },
        ],
        attachedAt: AT,
        detachedAt: null,
      })
    })

    it('attaching at 0 logs no change', () => {
      expect(change([], 0)).to.have.deep.nested.property(
        'attachment.rateChanges',
        [],
      )
    })

    it('logs each new rate and not a repeated one', () => {
      const same = change([attachment('a')], 500)
      const raised = change([attachment('a')], 900)

      expect(same).to.have.deep.nested.property('attachment.rateChanges', [])
      expect(raised).to.have.deep.nested.property('attachment.rateChanges', [
        { at: AT, fromCents: 500, toCents: 900, changedBy: WORKER },
      ])
    })

    it('detaching keeps the attachment and its rate', () => {
      const result = change([attachment('a')], null)

      expect(result).to.have.nested.property('attachment.detachedAt', AT)
      expect(result).to.have.nested.property('attachment.rateHourCents', 500)
      expect('attachments' in result && result.attachments).to.have.length(1)
    })

    it('a rate on a detached agent attaches it again', () => {
      const result = change([attachment('a', { detachedAt: AT })], 500)

      expect(result).to.have.nested.property('attachment.detachedAt', null)
    })

    it("leaves another worker's attachment of the same agent id alone", () => {
      const theirs = attachment('a', { workerId: OTHER })
      const result = change([theirs], 700)

      expect('attachments' in result && result.attachments).to.have.length(2)
      expect('attachments' in result && result.attachments[0]).to.equal(theirs)
    })

    it("refuses an agent that is not the worker's, or is removed", () => {
      expect(change([], 500, [])).to.deep.equal({ refused: 'NOT_OWN_AGENT' })
      expect(change([], 500, [agent('a', { removedAt: AT })])).to.deep.equal({
        refused: 'NOT_OWN_AGENT',
      })
    })

    it('refuses to detach what was never attached', () => {
      expect(change([], null)).to.deep.equal({ refused: 'NOT_FOUND' })
    })
  })
})
