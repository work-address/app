import { StatisticsInsights } from '@work-address/statistics-core'
import { describe, expect, it } from 'vitest'

import { buildDb, type Db } from './db'
import { DEFAULT_DEMO_SETTINGS, type DemoRole } from './settings'
import { shapeRun, shapeTime } from './shape'
import {
  DemoHttpError,
  insightsMe,
  overview,
  statisticsScope,
  team,
  type StatisticsQuery,
} from './statistics'

const NOW = new Date(2026, 9, 21, 15, 30).getTime()

const db = (role: DemoRole, world: 'typical' | 'busy' = 'typical') =>
  buildDb({ ...DEFAULT_DEMO_SETTINGS, role, world }, NOW)

const QUERY: StatisticsQuery = {
  from: '2026-09-01',
  to: '2026-10-22',
  timeZone: 'UTC',
}

const refused = (fn: () => unknown) => {
  try {
    fn()
  } catch (error) {
    return error instanceof DemoHttpError ? error.status : 'other'
  }
  return null
}

const totalsOf = (data: Db) =>
  overview(statisticsScope(data, data.meId, QUERY, NOW)).totals

describe('demo statistics per role', () => {
  it('gives an owner everything, with what is paid', () => {
    const totals = totalsOf(db('owner'))

    expect(totals.length).toBeGreaterThan(0)
    expect(totals.every((row) => 'paidSeconds' in row)).toBe(true)
  })

  it('never gives a viewer activity or money', () => {
    const totals = totalsOf(db('viewer'))

    expect(totals.length).toBeGreaterThan(0)
    for (const row of totals) {
      expect(row).not.toHaveProperty('paidSeconds')
      expect(row).not.toHaveProperty('activeSeconds')
    }
  })

  it('counts only a worker’s own time on projects they do not own', () => {
    const data = db('worker')
    const tracked = totalsOf(data).reduce(
      (sum, row) => sum + Number(row.trackedSeconds),
      0,
    )
    const from = new Date(`${QUERY.from}T00:00:00`).getTime()
    const to = new Date(`${QUERY.to}T00:00:00`).getTime()
    const own = data.times
      .filter((t) => t.userId === data.meId)
      .filter((t) => Date.parse(t.fromAt) >= from && Date.parse(t.fromAt) < to)
      .reduce(
        (sum, t) => sum + (Date.parse(t.toAt) - Date.parse(t.fromAt)) / 1000,
        0,
      )

    expect(tracked).toBe(own)
  })

  it('keeps the team list to owners', () => {
    const owner = db('owner')
    const worker = db('worker')

    expect(
      team(statisticsScope(owner, owner.meId, QUERY, NOW)).rows.length,
    ).toBeGreaterThan(0)
    expect(
      refused(() => team(statisticsScope(worker, worker.meId, QUERY, NOW))),
    ).toBe(403)
  })

  it('describes the reader in insights whoever the people filter selects', () => {
    const data = db('owner')
    const other = data.users.find((u) => u.id !== data.meId)!.id

    expect(
      insightsMe(data, data.meId, { ...QUERY, userIds: [other] }, NOW),
    ).toEqual(insightsMe(data, data.meId, QUERY, NOW))
  })

  it('takes every project of a busy account without naming them', () => {
    const data = db('owner', 'busy')
    const scope = statisticsScope(data, data.meId, QUERY, NOW)

    expect(scope.projects.length).toBeGreaterThan(100)
  })

  it('refuses a project the reader cannot see', () => {
    const data = db('owner')

    expect(
      refused(() =>
        statisticsScope(
          data,
          data.meId,
          { ...QUERY, projectIds: ['nope'] },
          NOW,
        ),
      ),
    ).toBe(403)
  })
})

describe('demo visibility of detail', () => {
  it('shows a worker their colleague’s time but not its detail', () => {
    const data = db('worker')
    const colleague = data.times.find((t) => t.userId !== data.meId && t.note)

    expect(colleague).toBeDefined()
    const shaped = shapeTime(data, colleague!, data.meId, NOW)

    expect(shaped.note).toBeNull()
    expect(shaped.minutesActive).toBeNull()
  })

  it('holds a worker’s fresh detail from the owner, and says so', () => {
    const data = db('owner')
    const fresh = data.times
      .filter((t) => t.userId !== data.meId)
      .sort((a, b) => b.toAt.localeCompare(a.toAt))[0]
    const shaped = shapeTime(
      data,
      fresh,
      data.meId,
      Date.parse(fresh.toAt) + 60_000,
    )

    expect(shaped).toMatchObject({
      screenshot: undefined,
      detailPendingReview: true,
    })
    expect(
      shapeTime(
        data,
        fresh,
        data.meId,
        Date.parse(fresh.toAt) + 25 * 3_600_000,
      ),
    ).not.toHaveProperty('detailPendingReview')
  })

  it('holds another worker’s prompt until review', () => {
    const data = db('owner')
    const run = data.runs.find((r) => r.userId !== data.meId && r.prompt)!
    const soon = Date.parse(run.toAt) + 60_000

    expect(shapeRun(data, run, data.meId, soon)).toMatchObject({
      prompt: null,
      promptPendingReview: true,
    })
    expect(
      shapeRun(data, { ...run, released: true }, data.meId, soon).prompt,
    ).toBe(run.prompt)
  })
})

describe('shared statistics rules', () => {
  it('are the API’s own, imported from the shared package', () => {
    // 30 min, a 10-minute gap, 20 min: one focus session of 50 minutes.
    const at = Date.UTC(2026, 9, 19, 9)
    const span = (from: number, to: number): [number, number] => [
      at + from * 60_000,
      at + to * 60_000,
    ]

    expect(
      StatisticsInsights.focusSessions([span(0, 30), span(40, 60)]),
    ).toEqual({
      count: 1,
      minutes: 50,
      longestMinutes: 50,
    })
  })
})
