import { describe, expect, it } from 'vitest'

import { parseTimeSearch, toTimeSearch } from './time-url'

const day = (value: string) => new Date(`${value}T00:00:00`).getTime()

describe('worklog URL', () => {
  it('leaves defaults out of the URL', () => {
    expect(toTimeSearch({}, { fromAt: 'DESC' }).toString()).toBe('')
  })

  it('round-trips every filter and the sort', () => {
    const filters = {
      fromAt: day('2026-10-19'),
      toAt: day('2026-10-24'),
      activityId: '0b6c6f6e-6b1a-4c3e-9a51-2f0b7c1d9e01',
      note: 'review',
      timeActiveMin: 5,
      timeActiveMax: 10,
      keyboardKeysMin: 100,
      keyboardKeysMax: 900,
      mouseKeysMin: 1,
      mouseKeysMax: 50,
      mouseDistanceMin: 0,
      mouseDistanceMax: 4000,
    }
    const search = toTimeSearch(filters, { minutesActive: 'ASC' })

    expect(search.get('from')).toBe('2026-10-19')
    expect(search.get('projects')).toBe('0b6c6f6e-6b1a-4c3e-9a51-2f0b7c1d9e01')
    expect(search.get('sort')).toBe('minutesActive')
    expect(search.get('order')).toBe('asc')
    expect(parseTimeSearch(search)).toEqual({
      filters,
      sort: { minutesActive: 'ASC' },
    })
  })

  it('opens a dashboard link with several projects on the first', () => {
    const { filters } = parseTimeSearch(
      new URLSearchParams(
        'projects=0b6c6f6e-6b1a-4c3e-9a51-2f0b7c1d9e01,5f2d1c3b-8e4a-4b7f-a0c9-6d1e2f3a4b5c',
      ),
    )

    expect(filters.activityId).toBe('0b6c6f6e-6b1a-4c3e-9a51-2f0b7c1d9e01')
  })

  it('drops malformed values instead of failing', () => {
    const { filters, sort } = parseTimeSearch(
      new URLSearchParams(
        'from=yesterday&to=2026-13-40&projects=a&keysMin=lots&sort=password&order=up',
      ),
    )

    expect(filters).toEqual({})
    expect(sort).toEqual({ fromAt: 'DESC' })
  })
})
