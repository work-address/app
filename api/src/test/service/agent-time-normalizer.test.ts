import { expect } from 'chai'
import { randomUUID } from 'crypto'
import { AgentTimeNormalizer } from '@/service/agent-time-normalizer'
import { parseEvent } from '@work-address/agent-tracking-contract'

describe('AgentTimeNormalizer', () => {
  const epoch = randomUUID()
  const at = Date.now() - 600000
  const event = (
    eventType: string,
    sequence: number,
    offset: number,
    extra = {},
  ) =>
    parseEvent({
      schemaVersion: 1,
      eventId: randomUUID(),
      source: {
        product: 'hermes',
        surface: 'cli',
        instanceId: randomUUID(),
        adapterVersion: '0.1.0',
        runtimeVersion: 'fixture',
        epoch,
        sequence,
      },
      projectId: randomUUID(),
      sessionId: 's',
      runId: 'r',
      agentId: 'root',
      occurredAt: new Date(at + offset).toISOString(),
      observedAt: new Date(at + offset).toISOString(),
      clock: { basis: 'source_wall' },
      capabilities: {
        runBoundaries: true,
        externalWaits: 'complete',
        replay: true,
      },
      eventType,
      ...extra,
    })
  it('does not extrapolate, trust claimed capabilities, or turn missing evidence into success', () => {
    const events = [
      event('run.started', 0, 0),
      event('run.observed', 1, 30000, {
        observedState: 'running',
        evidenceKind: 'runtime_state',
      }),
    ]
    const result = AgentTimeNormalizer.project(events, 'fixed', at + 3600000)
    if ('code' in result) throw new Error(result.code)
    expect(+result.toAt - +result.fromAt).to.equal(30000)
    expect(result.status).to.equal('unknown')
    expect(result.provisional).to.equal(true)
    expect(result.segments[0].state).to.equal('unknown')
    expect(
      AgentTimeNormalizer.project([...events].reverse(), 'fixed', at + 3600000),
    ).to.deep.equal(result)
  })
  it('keeps terminal-before-start pending and quarantines contradictory boundaries', () => {
    const start = event('run.started', 0, 0),
      end = event('run.completed', 1, 60000)
    expect(AgentTimeNormalizer.project([end], 'fixed')).to.deep.equal({
      code: 'MISSING_START',
    })
    expect(
      AgentTimeNormalizer.project(
        [start, end, event('run.failed', 2, 60000)],
        'fixed',
      ),
    ).to.deep.equal({ code: 'CONFLICTING_TERMINALS' })
    expect(
      AgentTimeNormalizer.project(
        [start, event('run.completed', 1, -1000)],
        'fixed',
      ),
    ).to.deep.equal({ code: 'CLOCK_REVERSAL' })
  })
  it('orders epochs independently instead of comparing reset sequence counters', () => {
    const start = event('run.started', 100, 0)
    const end = event('run.completed', 0, 60000)
    end.source.epoch = randomUUID()
    const result = AgentTimeNormalizer.project([end, start], 'fixed')
    if ('code' in result) throw new Error(result.code)
    expect(+result.toAt - +result.fromAt).to.equal(60000)
  })
  it('uses a late source terminal instead of a later provisional timer gate', () => {
    const events = [
      event('run.started', 0, 0),
      event('tracking.paused', 1, 180000, { reason: 'stopped' }),
      event('run.completed', 2, 60000),
    ]
    const result = AgentTimeNormalizer.project(events, 'timer')
    if ('code' in result) throw new Error(result.code)
    expect(+result.toAt - +result.fromAt).to.equal(60000)
    expect(result.segments.map((segment) => segment.state)).to.deep.equal([
      'unknown',
    ])
  })
})
