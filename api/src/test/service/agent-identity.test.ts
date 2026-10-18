import { expect } from 'chai'
import { parseEvent } from '@work-address/agent-tracking-contract'
import { AgentIdentity } from '@/service/agent-identity'
import { AgentRepository } from '@/repository/agent-repository'

describe('AgentIdentity', () => {
  it('canonicalizes UUIDs without altering opaque IDs or mutating the submitted event', () => {
    const id = 'ABCD1234-ABCD-4ABC-8ABC-ABCDEF123456'
    const event = parseEvent({
      schemaVersion: 1,
      eventId: id,
      projectId: id,
      source: {
        product: 'codex',
        surface: 'cli',
        instanceId: id,
        epoch: id,
        sequence: 0,
        adapterVersion: '0.1.0',
        runtimeVersion: 'fixture',
      },
      sessionId: 'SessionA',
      runId: 'RunA',
      agentId: 'AgentA',
      occurredAt: '2026-10-18T00:00:00.000Z',
      observedAt: '2026-10-18T00:00:00.000Z',
      clock: { basis: 'source_wall' },
      capabilities: {
        runBoundaries: true,
        externalWaits: 'none',
        replay: true,
      },
      eventType: 'run.started',
    })
    const normalized = AgentIdentity.event(event)
    expect(normalized).to.include({
      eventId: id.toLowerCase(),
      projectId: id.toLowerCase(),
      sessionId: 'SessionA',
      runId: 'RunA',
      agentId: 'AgentA',
    })
    expect(normalized.source).to.include({
      instanceId: id.toLowerCase(),
      epoch: id.toLowerCase(),
    })
    expect(event.source.instanceId).to.equal(id)
    expect(AgentRepository.runKey('worker', event)).to.equal(
      AgentRepository.runKey('worker', normalized),
    )
    expect(
      AgentRepository.runKey('worker', { ...normalized, runId: 'runa' }),
    ).not.to.equal(AgentRepository.runKey('worker', normalized))
  })
})
