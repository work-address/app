import { describe, expect, it } from 'vitest'

import {
  agentRunMode,
  agentRunsSearch,
  readAgentRunFilters,
  type AgentRun,
} from './agent-runs'

const now = new Date(2026, 10, 14, 12)

describe('readAgentRunFilters', () => {
  it('falls back to the last seven days', () => {
    expect(readAgentRunFilters(new URLSearchParams(), now)).toMatchObject({
      from: '2026-11-08',
      to: '2026-11-14',
    })
    // days the wrong way round are not a range either
    expect(
      readAgentRunFilters(
        new URLSearchParams({ from: '2026-11-10', to: '2026-11-01' }),
        now,
      ),
    ).toMatchObject({ from: '2026-11-08', to: '2026-11-14' })
  })

  it('reads every filter, and drops a mode it does not know', () => {
    const filters = readAgentRunFilters(
      new URLSearchParams({
        from: '2026-11-01',
        to: '2026-11-02',
        project: 'p',
        person: 'u',
        agent: 'a',
        mode: 'fixed',
        status: 'failed',
        session: 's',
      }),
      now,
    )
    expect(filters).toEqual({
      from: '2026-11-01',
      to: '2026-11-02',
      projectId: 'p',
      userId: 'u',
      agentId: 'a',
      mode: 'fixed',
      status: 'failed',
      sessionId: 's',
    })
    expect(
      readAgentRunFilters(new URLSearchParams({ mode: 'phone' }), now).mode,
    ).toBeUndefined()
  })
})

describe('agentRunsSearch', () => {
  it('writes what readAgentRunFilters reads, and the run to open', () => {
    const search = agentRunsSearch(
      { from: '2026-11-01', to: '2026-11-02', agentId: 'a', mode: 'timer' },
      'key',
    )
    const params = new URLSearchParams(search)
    expect(params.get('run')).toBe('key')
    expect(readAgentRunFilters(params, now)).toMatchObject({
      from: '2026-11-01',
      to: '2026-11-02',
      agentId: 'a',
      mode: 'timer',
    })
  })
})

describe('agentRunMode', () => {
  it("is a server's only when the run says fixed", () => {
    const run = { measurement: { mode: 'fixed' } } as AgentRun
    expect(agentRunMode(run)).toBe('fixed')
    expect(agentRunMode({} as AgentRun)).toBe('timer')
  })
})
