import { describe, expect, it } from 'vitest'

import {
  parseDateRange,
  previousDateRange,
  resolveDateRange,
  toApiDateRange,
  weekStartsOnFor,
} from './date-range'

// Wednesday, 22 October 2026.
const now = new Date(2026, 9, 22, 15, 30)

describe('date ranges', () => {
  it('starts the week where the language does', () => {
    expect(weekStartsOnFor('en')).toBe(0)
    expect(weekStartsOnFor('ru-RU')).toBe(1)
    expect(weekStartsOnFor('xx')).toBe(0)
  })

  it('resolves presets up to today', () => {
    expect(resolveDateRange('thisWeek', now, 1)).toEqual({
      preset: 'thisWeek',
      from: '2026-10-19',
      to: '2026-10-22',
    })
    expect(resolveDateRange('thisWeek', now, 0).from).toBe('2026-10-18')
    expect(resolveDateRange('lastWeek', now, 1)).toMatchObject({
      from: '2026-10-12',
      to: '2026-10-18',
    })
    expect(resolveDateRange('lastMonth', now, 1)).toMatchObject({
      from: '2026-09-01',
      to: '2026-09-30',
    })
  })

  it('compares a period in progress with the same elapsed stretch', () => {
    expect(
      previousDateRange(resolveDateRange('thisWeek', now, 1)),
    ).toMatchObject({ from: '2026-10-12', to: '2026-10-15' })
    expect(
      previousDateRange(resolveDateRange('thisMonth', now, 1)),
    ).toMatchObject({ from: '2026-09-01', to: '2026-09-22' })
    expect(
      previousDateRange({
        preset: 'thisMonth',
        from: '2026-03-01',
        to: '2026-03-31',
      }),
    ).toMatchObject({ from: '2026-02-01', to: '2026-02-28' })
  })

  it('compares a whole last month with the whole month before', () => {
    expect(
      previousDateRange({
        preset: 'lastMonth',
        from: '2026-10-01',
        to: '2026-10-31',
      }),
    ).toMatchObject({ from: '2026-09-01', to: '2026-09-30' })
  })

  it('shifts a custom range by its own length', () => {
    expect(
      previousDateRange({
        preset: 'custom',
        from: '2026-10-10',
        to: '2026-10-14',
      }),
    ).toMatchObject({ from: '2026-10-05', to: '2026-10-09' })
  })

  it('sends the API an exclusive end', () => {
    expect(toApiDateRange({ from: '2026-10-19', to: '2026-10-31' })).toEqual({
      from: '2026-10-19',
      to: '2026-11-01',
    })
  })

  it('reads URL days back as their preset, or as custom', () => {
    expect(parseDateRange('2026-10-19', '2026-10-22', now, 1).preset).toBe(
      'thisWeek',
    )
    expect(parseDateRange('2026-10-01', '2026-10-05', now, 1)).toEqual({
      preset: 'custom',
      from: '2026-10-01',
      to: '2026-10-05',
    })
  })

  it('falls back to this week on anything it cannot use', () => {
    const fallback = resolveDateRange('thisWeek', now, 1)

    expect(parseDateRange(null, null, now, 1)).toEqual(fallback)
    expect(parseDateRange('2026-02-30', '2026-03-01', now, 1)).toEqual(fallback)
    expect(parseDateRange('2026-10-22', '2026-10-01', now, 1)).toEqual(fallback)
    expect(parseDateRange('2024-01-01', '2026-01-01', now, 1)).toEqual(fallback)
  })
})
