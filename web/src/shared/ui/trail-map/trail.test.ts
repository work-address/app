import { describe, expect, it } from 'vitest'

import {
  hasFix,
  mayBeFaked,
  trailFixes,
  trailLegs,
  type TrailPoint,
} from './trail'

const at = (minute: number) =>
  new Date(Date.UTC(2026, 10, 14, 9, minute)).toISOString()

const fix = (minute: number, fields: Partial<TrailPoint> = {}): TrailPoint => ({
  at: at(minute),
  latitude: 52 + minute / 1000,
  longitude: 4 + minute / 1000,
  accuracy: 10,
  mock: false,
  ...fields,
})

const noFix = (minute: number): TrailPoint => ({
  at: at(minute),
  latitude: null,
  longitude: null,
  accuracy: null,
  mock: false,
})

const shape = (points: TrailPoint[]) =>
  trailLegs(points).map(({ from, to, known }) => [
    from.at.slice(14, 16),
    to.at.slice(14, 16),
    known,
  ])

describe('a trail', () => {
  it('joins fixes in time order, whatever order they came in', () => {
    expect(shape([fix(3), fix(1), fix(2)])).toEqual([
      ['01', '02', true],
      ['02', '03', true],
    ])
  })

  it('dashes the stretch where an attempt found no fix', () => {
    expect(shape([fix(1), noFix(2), noFix(3), fix(4), fix(5)])).toEqual([
      ['01', '04', false],
      ['04', '05', true],
    ])
  })

  it('dashes a stretch nobody recorded', () => {
    expect(shape([fix(1), fix(12)])).toEqual([['01', '12', false]])
  })

  it('starts at the first fix, not at an attempt before it', () => {
    expect(shape([noFix(0), fix(1), fix(2)])).toEqual([['01', '02', true]])
  })

  it('draws nothing from attempts alone', () => {
    expect(hasFix([noFix(1), noFix(2)])).toBe(false)
    expect(trailFixes([noFix(1), noFix(2)])).toEqual([])
    expect(trailLegs([noFix(1), noFix(2)])).toEqual([])
    expect(hasFix()).toBe(false)
  })

  it('is faked only where a fix says so', () => {
    expect(mayBeFaked([fix(1), fix(2, { mock: true })])).toBe(true)
    expect(mayBeFaked([fix(1), { ...noFix(2), mock: true }])).toBe(false)
    expect(mayBeFaked(null)).toBe(false)
  })
})
