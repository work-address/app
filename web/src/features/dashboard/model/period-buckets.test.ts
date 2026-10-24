import { describe, expect, it } from 'vitest'

import { bucketKeyOf, bucketSizeFor, periodBuckets } from './period-buckets'

describe('period buckets', () => {
  it('draws days, then weeks, then months as the period grows', () => {
    expect(bucketSizeFor({ from: '2026-10-01', to: '2026-10-31' })).toBe('day')
    expect(bucketSizeFor({ from: '2026-07-01', to: '2026-10-31' })).toBe('week')
    expect(bucketSizeFor({ from: '2026-01-01', to: '2026-10-31' })).toBe(
      'month',
    )
  })

  it('lists every day of a week, empty ones included', () => {
    expect(
      periodBuckets({ from: '2026-10-19', to: '2026-10-25' }, 1).map(
        (b) => b.key,
      ),
    ).toEqual([
      '2026-10-19',
      '2026-10-20',
      '2026-10-21',
      '2026-10-22',
      '2026-10-23',
      '2026-10-24',
      '2026-10-25',
    ])
  })

  it('starts weeks on the locale first day', () => {
    const buckets = periodBuckets({ from: '2026-08-01', to: '2026-10-31' }, 1)

    expect(buckets[0].key).toBe('2026-07-27')
    expect(bucketKeyOf('2026-10-21', 'week', 1)).toBe('2026-10-19')
    expect(bucketKeyOf('2026-10-21', 'week', 0)).toBe('2026-10-18')
  })

  it('groups a year into months', () => {
    const buckets = periodBuckets({ from: '2026-01-01', to: '2026-10-24' }, 1)

    expect(buckets).toHaveLength(10)
    expect(bucketKeyOf('2026-10-24', 'month', 1)).toBe('2026-10-01')
  })
})
