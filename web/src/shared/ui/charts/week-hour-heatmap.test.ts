import { describe, expect, it } from 'vitest'

import { clampPopupLeft, weekHourPopupSide } from './week-hour-heatmap'

describe('heatmap popup placement', () => {
  it('opens below every row but the last two, which open above', () => {
    expect(weekHourPopupSide(0, 7)).toBe('below')
    expect(weekHourPopupSide(4, 7)).toBe('below')
    expect(weekHourPopupSide(5, 7)).toBe('above')
    expect(weekHourPopupSide(6, 7)).toBe('above')
  })

  it('centres on the cell, held inside the heatmap', () => {
    expect(clampPopupLeft(300, 200, 600)).toBe(200)
    expect(clampPopupLeft(40, 200, 600)).toBe(0)
    expect(clampPopupLeft(590, 200, 600)).toBe(400)
  })

  it('starts at the left edge when it is as wide as the heatmap', () => {
    expect(clampPopupLeft(300, 600, 600)).toBe(0)
  })
})
