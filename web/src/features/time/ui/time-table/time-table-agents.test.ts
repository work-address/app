import { describe, expect, it } from 'vitest'

import { getTableAgentRange, getTableAgentSummaries } from './time-table-agents'

import type { Time, TimeAgentRun } from '@/entities/time'

const entry = (
  id: string,
  fromAt: string,
  toAt: string,
  project = 'project',
  trackAgents = true,
) =>
  ({
    id,
    fromAt,
    toAt,
    user: { id: 'author' },
    project: { id: project, trackAgents },
  }) as unknown as Time

const run = (
  runKey: string,
  fromAt: string,
  toAt: string,
  extra: Partial<TimeAgentRun> = {},
): TimeAgentRun => ({
  runKey,
  userId: 'author',
  projectId: 'project',
  product: 'claude-code',
  fromAt,
  toAt,
  status: 'completed',
  segments: [{ fromAt, toAt, state: 'running' }],
  ...extra,
})

describe('getTableAgentSummaries', () => {
  it('gives each entry its newest run, its working minutes and how many runs', () => {
    const summaries = getTableAgentSummaries(
      [
        run('first', '2026-10-24T00:30:00.000Z', '2026-10-24T00:44:00.000Z', {
          prompt: 'Older',
        }),
        run('second', '2026-10-24T00:46:00.000Z', '2026-10-24T00:55:00.000Z', {
          prompt: 'Newer',
          segments: [
            {
              fromAt: '2026-10-24T00:46:00.000Z',
              toAt: '2026-10-24T00:48:00.000Z',
              state: 'running',
            },
            {
              fromAt: '2026-10-24T00:48:00.000Z',
              toAt: '2026-10-24T00:55:00.000Z',
              state: 'human_wait',
            },
          ],
        }),
      ],
      [
        entry('a', '2026-10-24T00:40:00.000Z', '2026-10-24T00:50:00.000Z'),
        entry('b', '2026-10-24T01:00:00.000Z', '2026-10-24T01:10:00.000Z'),
      ],
    )

    expect([...summaries.keys()]).toEqual(['a'])
    const a = summaries.get('a')!
    expect(a.latest.prompt).toBe('Newer')
    expect(a.count).toBe(2)
    // 4 minutes of the first and 2 of the second inside the entry; the wait is not working
    expect(a.runningMinutes).toBeCloseTo(6)
    expect(a.minutes).toBeCloseTo(8)
  })

  it("leaves out another project's and another person's runs", () => {
    const summaries = getTableAgentSummaries(
      [
        run(
          'elsewhere',
          '2026-10-24T00:41:00.000Z',
          '2026-10-24T00:45:00.000Z',
          {
            projectId: 'other',
          },
        ),
        run('someone', '2026-10-24T00:41:00.000Z', '2026-10-24T00:45:00.000Z', {
          userId: 'someone',
        }),
      ],
      [entry('a', '2026-10-24T00:40:00.000Z', '2026-10-24T00:50:00.000Z')],
    )

    expect(summaries.size).toBe(0)
  })
})

describe('getTableAgentRange', () => {
  it('spans the entries whose projects track agents', () => {
    expect(
      getTableAgentRange([
        entry('a', '2026-10-24T00:40:00.000Z', '2026-10-24T00:50:00.000Z'),
        entry('b', '2026-10-22T09:00:00.000Z', '2026-10-22T09:10:00.000Z'),
        entry(
          'c',
          '2026-10-20T09:00:00.000Z',
          '2026-10-20T09:10:00.000Z',
          'quiet',
          false,
        ),
      ]),
    ).toEqual({
      fromAt: '2026-10-22T09:00:00.000Z',
      toAt: '2026-10-24T00:50:00.000Z',
    })
  })

  it('is none when no project tracks agents', () => {
    expect(
      getTableAgentRange([
        entry(
          'c',
          '2026-10-20T09:00:00.000Z',
          '2026-10-20T09:10:00.000Z',
          'quiet',
          false,
        ),
      ]),
    ).toBeNull()
  })
})
