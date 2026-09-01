import { describe, expect, it } from 'vitest'

import { createTimeStub } from '../__fixtures__/time-stub'

import {
  getTimeActivityPercent,
  getTimeActivityTone,
  getTimeDayKey,
  getTimeSlotMinutes,
  groupTimeByDay,
} from './time-grid'

/** Local midnight, so a case reads the same wherever the suite runs. */
const at = (day: number, hour: number, minute = 0) =>
  new Date(2026, 8, day, hour, minute).toISOString()

describe('getTimeSlotMinutes', () => {
  it('measures the span between the two timestamps', () => {
    const entry = createTimeStub({ fromAt: at(1, 9), toAt: at(1, 9, 10) })

    expect(getTimeSlotMinutes(entry)).toBe(10)
  })

  it('is zero for an empty, reversed or unparseable range', () => {
    const empty = createTimeStub({ fromAt: at(1, 9), toAt: at(1, 9) })
    const reversed = createTimeStub({ fromAt: at(1, 9, 10), toAt: at(1, 9) })
    const unparseable = createTimeStub({ fromAt: 'not a date', toAt: at(1, 9) })

    expect(getTimeSlotMinutes(empty)).toBe(0)
    expect(getTimeSlotMinutes(reversed)).toBe(0)
    expect(getTimeSlotMinutes(unparseable)).toBe(0)
  })
})

describe('getTimeActivityPercent', () => {
  it('reports the active share of the slot', () => {
    const entry = createTimeStub({
      fromAt: at(1, 9),
      toAt: at(1, 9, 10),
      minutesActive: 6,
    })

    expect(getTimeActivityPercent(entry)).toBe(60)
  })

  it('rounds to whole percent', () => {
    const entry = createTimeStub({
      fromAt: at(1, 9),
      toAt: at(1, 9, 3),
      minutesActive: 1,
    })

    expect(getTimeActivityPercent(entry)).toBe(33)
  })

  it('never exceeds 100, even when more minutes are active than tracked', () => {
    const entry = createTimeStub({
      fromAt: at(1, 9),
      toAt: at(1, 9, 10),
      minutesActive: 25,
    })

    expect(getTimeActivityPercent(entry)).toBe(100)
  })

  it('is zero when the slot has no length to be active within', () => {
    const entry = createTimeStub({
      fromAt: at(1, 9),
      toAt: at(1, 9),
      minutesActive: 5,
    })

    expect(getTimeActivityPercent(entry)).toBe(0)
  })
})

describe('getTimeActivityTone', () => {
  it('splits at 30 and 60 percent', () => {
    expect(getTimeActivityTone(0)).toBe('low')
    expect(getTimeActivityTone(29)).toBe('low')
    expect(getTimeActivityTone(30)).toBe('medium')
    expect(getTimeActivityTone(59)).toBe('medium')
    expect(getTimeActivityTone(60)).toBe('high')
    expect(getTimeActivityTone(100)).toBe('high')
  })

  it('agrees with the badge buckets the list view uses at a ten-minute slot', () => {
    const toneOfMinutes = (minutesActive: number) =>
      getTimeActivityTone(
        getTimeActivityPercent(
          createTimeStub({
            fromAt: at(1, 9),
            toAt: at(1, 9, 10),
            minutesActive,
          }),
        ),
      )

    // getTimeActiveColor: 0-2 red, 3-5 orange, 6+ green.
    expect([0, 1, 2].map(toneOfMinutes)).toEqual(['low', 'low', 'low'])
    expect([3, 4, 5].map(toneOfMinutes)).toEqual(['medium', 'medium', 'medium'])
    expect([6, 10].map(toneOfMinutes)).toEqual(['high', 'high'])
  })
})

describe('groupTimeByDay', () => {
  it('returns nothing for an empty feed', () => {
    expect(groupTimeByDay([])).toEqual([])
  })

  it('keeps feed order for both days and the entries inside them', () => {
    const groups = groupTimeByDay([
      createTimeStub({ id: 'b', fromAt: at(2, 9), toAt: at(2, 9, 10) }),
      createTimeStub({ id: 'a', fromAt: at(1, 9), toAt: at(1, 9, 10) }),
      createTimeStub({ id: 'c', fromAt: at(2, 8), toAt: at(2, 8, 10) }),
    ])

    expect(groups.map((group) => group.day)).toEqual([
      '2026-09-02',
      '2026-09-01',
    ])
    expect(groups[0].entries.map((entry) => entry.id)).toEqual(['b', 'c'])
    expect(groups[1].entries.map((entry) => entry.id)).toEqual(['a'])
  })

  it('groups by local day rather than the UTC one', () => {
    // 23:30 local on the 1st: a UTC-based key would file this under the 2nd
    // anywhere east of Greenwich.
    const groups = groupTimeByDay([
      createTimeStub({ fromAt: at(1, 23, 30), toAt: at(1, 23, 40) }),
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0].day).toBe('2026-09-01')
    expect(groups[0].date.getDate()).toBe(1)
    expect(groups[0].date.getHours()).toBe(0)
  })

  it('totals tracked and active minutes across the day', () => {
    const groups = groupTimeByDay([
      createTimeStub({
        fromAt: at(1, 9),
        toAt: at(1, 9, 10),
        minutesActive: 6,
      }),
      createTimeStub({
        fromAt: at(1, 10),
        toAt: at(1, 10, 10),
        minutesActive: 3,
      }),
    ])

    expect(groups[0].trackedMinutes).toBe(20)
    expect(groups[0].activeMinutes).toBe(9)
    expect(groups[0].activityPercent).toBe(45)
  })

  it('drops entries with no readable start, since they have no day to sit in', () => {
    const groups = groupTimeByDay([
      createTimeStub({ id: 'ok', fromAt: at(1, 9), toAt: at(1, 9, 10) }),
      createTimeStub({ id: 'broken', fromAt: '', toAt: at(1, 9, 10) }),
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0].entries.map((entry) => entry.id)).toEqual(['ok'])
  })
})

describe('getTimeDayKey', () => {
  it('names the local day the entry starts on', () => {
    expect(getTimeDayKey(createTimeStub({ fromAt: at(1, 23, 30) }))).toBe(
      '2026-09-01',
    )
  })

  it('is empty when the start cannot be read', () => {
    expect(getTimeDayKey(createTimeStub({ fromAt: '' }))).toBe('')
  })

  it('changes exactly where the list has to draw a heading', () => {
    // The list emits a heading wherever this key differs from the row above,
    // so the boundaries it produces are what these indexes assert.
    const feed = [
      createTimeStub({ fromAt: at(2, 10) }),
      createTimeStub({ fromAt: at(2, 9) }),
      createTimeStub({ fromAt: at(1, 17) }),
      createTimeStub({ fromAt: at(1, 9) }),
    ]

    const keys = feed.map(getTimeDayKey)
    const boundaries = keys
      .map((key, index) =>
        index === 0 || keys[index - 1] !== key ? index : -1,
      )
      .filter((index) => index >= 0)

    expect(boundaries).toEqual([0, 2])
    expect(keys[0]).toBe(groupTimeByDay(feed)[0].day)
    expect(keys[2]).toBe(groupTimeByDay(feed)[1].day)
  })
})
