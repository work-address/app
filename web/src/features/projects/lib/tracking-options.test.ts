import { describe, expect, it } from 'vitest'

import {
  detailPolicyForApps,
  isValidReviewWindowHours,
  isValidScreenshotRetentionDays,
  readWholeNumber,
} from './tracking-options'

describe('project tracking options', () => {
  it('reads a blank field as unset and junk as invalid, never as zero', () => {
    expect(readWholeNumber('')).toBe(null)
    expect(readWholeNumber('  ')).toBe(null)
    expect(readWholeNumber('12')).toBe(12)
    expect(readWholeNumber('1.5')).toBeNaN()
    expect(readWholeNumber('abc')).toBeNaN()
    expect(readWholeNumber('-3')).toBeNaN()
  })
  it('accepts only the server ranges for the window and retention', () => {
    expect(isValidReviewWindowHours(1)).toBe(true)
    expect(isValidReviewWindowHours(24)).toBe(true)
    expect(isValidReviewWindowHours(0)).toBe(false)
    expect(isValidReviewWindowHours(25)).toBe(false)
    expect(isValidReviewWindowHours(1.5)).toBe(false)
    expect(isValidReviewWindowHours(Number.NaN)).toBe(false)
    expect(isValidReviewWindowHours(null)).toBe(false)
    expect(isValidScreenshotRetentionDays(null)).toBe(true)
    expect(isValidScreenshotRetentionDays(1)).toBe(true)
    expect(isValidScreenshotRetentionDays(3650)).toBe(true)
    expect(isValidScreenshotRetentionDays(0)).toBe(false)
    expect(isValidScreenshotRetentionDays(3651)).toBe(false)
    expect(isValidScreenshotRetentionDays(Number.NaN)).toBe(false)
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
