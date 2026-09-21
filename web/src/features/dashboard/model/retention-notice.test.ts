import { describe, expect, it } from 'vitest'

import { formatRotationDate, retentionNoticeDue } from './retention-notice'

import type { RetentionNotice } from './retention-notice'

const due: RetentionNotice = {
  count: 3,
  rotatesAt: '2026-09-24T09:00:00.000Z',
  windowDays: 14,
  noticeDays: 3,
}

describe('retentionNoticeDue', () => {
  it('tells a free owner what is about to rotate', () => {
    expect(retentionNoticeDue(due, 'free')).toBe(true)
  })

  it('tells nobody else: premium keeps it all, self-host has no free tier', () => {
    expect(retentionNoticeDue(due, 'premium')).toBe(false)
    expect(retentionNoticeDue(due, 'unbilled')).toBe(false)
  })

  it('says nothing when nothing is due or the notice has not loaded', () => {
    expect(retentionNoticeDue({ ...due, count: 0 }, 'free')).toBe(false)
    expect(retentionNoticeDue({ ...due, rotatesAt: null }, 'free')).toBe(false)
    expect(retentionNoticeDue(null, 'free')).toBe(false)
  })
})

describe('formatRotationDate', () => {
  it('names the day in the reader’s language', () => {
    expect(formatRotationDate(due.rotatesAt!, 'en')).toContain('2026')
    expect(formatRotationDate(due.rotatesAt!, 'ja')).toContain('2026')
  })
})
