import { describe, expect, it } from 'vitest'

import { bucketBreakdowns } from './bucket-breakdown'

describe('bucket breakdowns', () => {
  it('gathers people by project and agents by product under each bar', () => {
    const map = bucketBreakdowns(
      [
        { day: '2026-10-25T09', projectId: 'a', trackedSeconds: 1800 },
        { day: '2026-10-25T09', projectId: 'b', trackedSeconds: 3600 },
        { day: '2026-10-25T10', projectId: 'a', trackedSeconds: 600 },
      ],
      [
        {
          day: '2026-10-25T09',
          product: 'codex',
          assistedSeconds: 600,
          autonomousSeconds: 0,
          waitSeconds: 120,
        },
        {
          day: '2026-10-25T09',
          product: 'claude-code',
          assistedSeconds: 1200,
          autonomousSeconds: 600,
          waitSeconds: 0,
        },
      ],
      'hour',
      1,
    )
    const nine = map.get('2026-10-25T09')!

    expect(nine.peopleMinutes).toBe(90)
    expect(nine.projects.map((p) => p.projectId)).toEqual(['b', 'a'])
    expect(nine.agents).toEqual({ assisted: 30, autonomous: 10, waiting: 2 })
    expect(nine.products.map((p) => p.product)).toEqual([
      'claude-code',
      'codex',
    ])
    expect(map.get('2026-10-25T10')!.agents.assisted).toBe(0)
  })

  it('adds days up into their week', () => {
    const map = bucketBreakdowns(
      [
        { day: '2026-10-20', projectId: 'a', trackedSeconds: 3600 },
        { day: '2026-10-22', projectId: 'a', trackedSeconds: 3600 },
      ],
      [],
      'week',
      1,
    )

    expect(map.get('2026-10-19')!.peopleMinutes).toBe(120)
  })
})
