import { describe, expect, it } from 'vitest'

import {
  detailPolicyForApps,
  isValidReviewWindowHours,
  reviewWindowHourChoices,
} from './tracking-options'

describe('project tracking options', () => {
  it('accepts only the server range for the review window', () => {
    expect(isValidReviewWindowHours(1)).toBe(true)
    expect(isValidReviewWindowHours(24)).toBe(true)
    expect(isValidReviewWindowHours(0)).toBe(false)
    expect(isValidReviewWindowHours(25)).toBe(false)
    expect(isValidReviewWindowHours(1.5)).toBe(false)
    expect(isValidReviewWindowHours(Number.NaN)).toBe(false)
    expect(isValidReviewWindowHours(null)).toBe(false)
  })
  it('offers 1-12 hours and keeps a longer saved window as a choice', () => {
    const base = Array.from({ length: 12 }, (_, index) => index + 1)
    expect(reviewWindowHourChoices(6)).toEqual(base)
    expect(reviewWindowHourChoices(24)).toEqual([...base, 24])
    expect(reviewWindowHourChoices(Number.NaN)).toEqual(base)
  })
  it('switches titles and domains off with apps, as the server will', () => {
    const on = { trackWindowTitles: true, trackBrowserDomains: true, other: 1 }
    expect(detailPolicyForApps(on, true)).toEqual(on)
    expect(detailPolicyForApps(on, false)).toEqual({
      trackWindowTitles: false,
      trackBrowserDomains: false,
      other: 1,
    })
  })
})
