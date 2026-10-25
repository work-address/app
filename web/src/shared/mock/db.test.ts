import { describe, expect, it } from 'vitest'

import { buildDb } from './db'
import {
  DEFAULT_DEMO_SETTINGS,
  type DemoRole,
  type DemoSettings,
  type DemoWorldId,
} from './settings'

// Wednesday, 21 October 2026, mid-afternoon.
const NOW = new Date(2026, 9, 21, 15, 30).getTime()

const world = (
  world: DemoWorldId,
  role: DemoRole = 'owner',
  patch: Partial<DemoSettings> = {},
) => buildDb({ ...DEFAULT_DEMO_SETTINGS, world, role, ...patch }, NOW)

describe('demo worlds', () => {
  it('sizes each world as the panel promises', () => {
    expect(world('empty').projects).toHaveLength(0)
    expect(world('empty').times).toHaveLength(0)
    expect(world('starter').projects).toHaveLength(1)
    expect(world('typical').projects.length).toBeGreaterThanOrEqual(3)
    expect(world('typical').projects.length).toBeLessThanOrEqual(5)
    // Past the 100 ids a statistics request may name.
    expect(world('busy').projects.length).toBeGreaterThan(100)
    expect(world('busy').users.length).toBeGreaterThanOrEqual(25)
  })

  it('has time, runs, screenshots and invoices in every state once there is data', () => {
    const db = world('typical')

    expect(db.times.length).toBeGreaterThan(50)
    expect(db.runs.some((run) => run.prompt)).toBe(true)
    expect(db.times.some((time) => time.screenshot !== null)).toBe(true)
    expect(db.times.some((time) => time.source !== 'desktop')).toBe(true)
    expect(new Set(db.invoices.map((i) => i.state))).toEqual(
      new Set(['PAID', 'Requested', 'REJECTED']),
    )
  })

  it('is the same world on every load of the same day', () => {
    expect(JSON.stringify(world('typical'))).toBe(
      JSON.stringify(world('typical')),
    )
  })

  it('redraws a random world with another seed', () => {
    const a = world('random', 'owner', { seed: 1 })
    const b = world('random', 'owner', { seed: 2 })

    expect(a.projects.map((p) => p.title)).not.toEqual(
      b.projects.map((p) => p.title),
    )
  })

  it('keeps time relative to today and never in the future', () => {
    const db = world('typical')
    const newest = Math.max(...db.times.map((t) => Date.parse(t.toAt)))

    expect(newest).toBeLessThanOrEqual(NOW)
    expect(NOW - newest).toBeLessThan(3 * 24 * 3_600_000)
  })

  it('relates the viewer to every project as their role says', () => {
    const owner = world('typical', 'owner')
    const worker = world('typical', 'worker')
    const viewer = world('typical', 'viewer')
    const mixed = world('typical', 'mixed')

    expect(owner.projects.every((p) => p.ownerId === owner.meId)).toBe(true)
    expect(
      worker.projects.every(
        (p) => p.ownerId !== worker.meId && p.workerIds.includes(worker.meId),
      ),
    ).toBe(true)
    expect(
      viewer.projects.every(
        (p) => p.ownerId !== viewer.meId && p.viewerIds.includes(viewer.meId),
      ),
    ).toBe(true)
    expect(viewer.times.some((t) => t.userId === viewer.meId)).toBe(false)
    expect(mixed.projects.some((p) => p.ownerId === mixed.meId)).toBe(true)
    expect(mixed.projects.some((p) => p.workerIds.includes(mixed.meId))).toBe(
      true,
    )
  })

  it('fills a finished profile and leaves a fresh one bare', () => {
    const finished = world('starter', 'owner', { profile: 'finished' })
    const fresh = world('starter', 'owner', { profile: 'fresh' })
    const me = (db: typeof fresh) => db.users.find((u) => u.id === db.meId)!

    expect(me(finished).bio).toBeTruthy()
    expect(me(finished).skills).toBeTruthy()
    expect(me(fresh).name).toBe('')
    expect(me(fresh).bio).toBeNull()
  })
})
