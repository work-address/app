import { describe, expect, it } from 'vitest'

import { getEntryAgentRuns } from './time-dialog-agents'

import type { Time, TimeAgentRun } from '@/entities/time'

const entry = {
  fromAt: '2026-10-24T00:40:00.000Z',
  toAt: '2026-10-24T00:50:00.000Z',
  user: { id: 'author' },
} as unknown as Time

const run = (
  id: string,
  fromAt: string,
  toAt: string,
  userId = 'author',
): TimeAgentRun => ({
  id,
  userId,
  product: 'claude-code',
  fromAt,
  toAt,
  status: 'completed',
})

describe('getEntryAgentRuns', () => {
  it("keeps the author's runs inside the entry, with their minutes in it, oldest first", () => {
    const items = getEntryAgentRuns(
      [
        run('late', '2026-10-24T00:47:53.000Z', '2026-10-24T00:50:21.000Z'),
        run('early', '2026-10-24T00:30:00.000Z', '2026-10-24T00:42:30.000Z'),
        run(
          'other worker',
          '2026-10-24T00:41:00.000Z',
          '2026-10-24T00:44:00.000Z',
          'someone',
        ),
        run('before', '2026-10-24T00:20:00.000Z', '2026-10-24T00:40:00.000Z'),
        run('after', '2026-10-24T00:50:00.000Z', '2026-10-24T00:55:00.000Z'),
      ],
      entry,
    )
    expect(items.map(({ run }) => run.id)).toEqual(['early', 'late'])
    expect(items[0].minutes).toBeCloseTo(2.5)
    // a run past the entry's end counts only up to it
    expect(items[1].minutes).toBeCloseTo((2 * 60 + 7) / 60)
  })

  it("keeps every run when the entry's author is not known", () => {
    const anonymous = { ...entry, user: undefined } as unknown as Time
    const items = getEntryAgentRuns(
      [
        run(
          'a',
          '2026-10-24T00:41:00.000Z',
          '2026-10-24T00:42:00.000Z',
          'someone',
        ),
      ],
      anonymous,
    )
    expect(items).toHaveLength(1)
  })
})
