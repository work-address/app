import { describe, expect, it } from 'vitest'

import {
  centsToRateInput,
  namesItsProduct,
  ownAgentRows,
  ownsEveryProject,
  parseRateCents,
} from './team-rows'

import type { OwnAgent, Team } from './types'

const agent = (id: string, removedAt: string | null = null): OwnAgent => ({
  id,
  name: id,
  product: 'codex',
  removedAt,
})

const team = (overrides: Partial<Team['projects'][number]> = {}): Team => ({
  viewerOnly: false,
  projects: [
    {
      id: 'p1',
      title: 'Site',
      state: 'Active',
      role: 'worker',
      trackAgents: true,
      people: [
        {
          address: '0xme',
          userId: 'me',
          name: 'Me',
          role: 'worker',
          agents: [
            {
              id: 'mine',
              name: 'mine',
              product: 'codex',
              rateHourCents: 1500,
              attachedAt: '2026-11-01T00:00:00.000Z',
              lastRateChange: null,
            },
          ],
        },
        {
          address: '0xother',
          userId: 'other',
          name: 'Other',
          role: 'worker',
          agents: [
            {
              id: 'mine',
              name: 'same id, other person',
              product: 'codex',
              rateHourCents: 9900,
              attachedAt: '2026-11-01T00:00:00.000Z',
              lastRateChange: null,
            },
          ],
        },
      ],
      ...overrides,
    },
  ],
})

describe('parseRateCents', () => {
  it.each([
    ['0', 0],
    ['12', 1200],
    ['12.5', 1250],
    ['19.99', 1999],
    [' 7.05 ', 705],
    ['1000000', 100_000_000],
  ])('reads %s as %d cents', (typed, cents) => {
    expect(parseRateCents(typed)).toBe(cents)
  })

  it.each(['', '-1', '1.234', 'abc', '1,5', '1000000.01'])(
    'refuses %s',
    (typed) => {
      expect(parseRateCents(typed)).toBeNull()
    },
  )
})

describe('centsToRateInput', () => {
  it('shows cents only when there are some', () => {
    expect(centsToRateInput(1200)).toBe('12')
    expect(centsToRateInput(1250)).toBe('12.50')
    expect(centsToRateInput(0)).toBe('0')
  })
})

describe('namesItsProduct', () => {
  it('tells a default name from a chosen one', () => {
    expect(namesItsProduct('Claude Code', 'claude-code')).toBe(true)
    expect(namesItsProduct('My Codex', 'codex')).toBe(false)
  })
})

describe('ownsEveryProject', () => {
  it('holds only when the reader owns all their projects', () => {
    expect(ownsEveryProject(team({ role: 'owner' }))).toBe(true)
    expect(ownsEveryProject(team({ role: 'worker' }))).toBe(false)
  })

  it('is false when another owner is involved', () => {
    const [mine] = team({ role: 'owner' }).projects
    const [theirs] = team({ id: 'p2', role: 'worker' }).projects

    expect(
      ownsEveryProject({ viewerOnly: false, projects: [mine, theirs] }),
    ).toBe(false)
  })

  it('is false before the team loads, or with no projects', () => {
    expect(ownsEveryProject(null)).toBe(false)
    expect(ownsEveryProject({ viewerOnly: false, projects: [] })).toBe(false)
  })
})

describe('ownAgentRows', () => {
  it('takes rates from the reader only', () => {
    const [row] = ownAgentRows([agent('mine')], team(), 'me')

    expect(row.attachments).toEqual([
      {
        projectId: 'p1',
        projectTitle: 'Site',
        projectState: 'Active',
        trackAgents: true,
        rateHourCents: 1500,
      },
    ])
  })

  it('keeps an agent attached nowhere', () => {
    expect(ownAgentRows([agent('idle')], team(), 'me')).toEqual([
      { id: 'idle', name: 'idle', product: 'codex', attachments: [] },
    ])
  })

  it('leaves out a removed agent', () => {
    expect(ownAgentRows([agent('gone', 'then')], team(), 'me')).toEqual([])
  })

  it('has no attachments before the team loads', () => {
    expect(ownAgentRows([agent('mine')], null, 'me')[0].attachments).toEqual([])
  })
})
