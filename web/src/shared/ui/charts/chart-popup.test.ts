import { describe, expect, it } from 'vitest'

import { placeChartPopup, pointInside } from './chart-popup'

const viewport = { width: 1000, height: 800 }
const size = { width: 200, height: 100 }
const point = (left: number, top: number) => ({
  left,
  top,
  right: left,
  bottom: top,
})

describe('placeChartPopup below', () => {
  const place = (anchor: ReturnType<typeof point>, over = size) =>
    placeChartPopup({ anchor, size: over, viewport, side: 'below' })

  it('opens under the anchor, centred on it', () => {
    expect(place(point(500, 100))).toEqual({ left: 400, top: 108 })
  })

  it('opens over the anchor when only that has room', () => {
    expect(place(point(500, 750))).toEqual({ left: 400, top: 642 })
  })

  it('takes the roomier side, held on screen, when neither has room', () => {
    const tall = { width: 200, height: 600 }

    expect(place(point(500, 300), tall)).toEqual({ left: 400, top: 192 })
    expect(place(point(500, 500), tall)).toEqual({ left: 400, top: 8 })
  })

  it('slides back from either edge of the screen', () => {
    expect(place(point(20, 100)).left).toBe(8)
    expect(place(point(990, 100)).left).toBe(792)
  })

  it('keeps the top left corner on a screen too small for it', () => {
    expect(place(point(100, 100), { width: 1200, height: 1000 })).toEqual({
      left: 8,
      top: 8,
    })
  })
})

describe('placeChartPopup beside', () => {
  const place = (anchor: ReturnType<typeof point>, over = size) =>
    placeChartPopup({ anchor, size: over, viewport, side: 'beside' })

  it('opens to the right of the anchor', () => {
    expect(place(point(100, 100))).toEqual({ left: 108, top: 100 })
  })

  it('opens to the left when the right has no room', () => {
    expect(place(point(900, 100))).toEqual({ left: 692, top: 100 })
  })

  it('rises to stay on screen', () => {
    expect(place(point(100, 780)).top).toBe(692)
  })

  it('drops under the anchor when neither side has room', () => {
    expect(place(point(500, 100), { width: 700, height: 100 })).toEqual({
      left: 150,
      top: 108,
    })
  })

  it('honours a wider gap, for an anchor inside a padded card', () => {
    expect(
      placeChartPopup({
        anchor: { left: 800, top: 100, right: 950, bottom: 400 },
        size,
        viewport,
        side: 'beside',
        gap: 24,
      }),
    ).toEqual({ left: 576, top: 100 })
  })
})

describe('pointInside', () => {
  const element = {
    getBoundingClientRect: () => ({ left: 50, top: 70 }),
  } as HTMLElement

  it('turns a point in the element into one on the screen', () => {
    expect(pointInside(element, { x: 10, y: 20 })).toEqual(point(60, 90))
  })

  it('has no answer without an element or a point', () => {
    expect(pointInside(null, { x: 10, y: 20 })).toBeNull()
    expect(pointInside(element)).toBeNull()
  })
})
