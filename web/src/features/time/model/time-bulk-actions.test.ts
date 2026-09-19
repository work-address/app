import { describe, expect, it } from 'vitest'

import {
  isTimeBulkActionAvailable,
  TIME_BULK_ACTIONS,
} from './time-bulk-actions'

describe('isTimeBulkActionAvailable', () => {
  it('offers no delete when a selected entry is on an invoice', () => {
    expect(isTimeBulkActionAvailable('delete', { hasInvoiced: true })).toBe(
      false,
    )
  })

  it('offers delete when no selected entry is on an invoice', () => {
    expect(isTimeBulkActionAvailable('delete', { hasInvoiced: false })).toBe(
      true,
    )
  })

  it('keeps screenshots and processes removable from invoiced entries', () => {
    for (const hasInvoiced of [true, false]) {
      expect(
        isTimeBulkActionAvailable('removeScreenshots', { hasInvoiced }),
      ).toBe(true)
      expect(
        isTimeBulkActionAvailable('removeProcesses', { hasInvoiced }),
      ).toBe(true)
    }
  })

  it('leaves only delete out of an invoiced selection', () => {
    expect(
      TIME_BULK_ACTIONS.filter(
        (action) => !isTimeBulkActionAvailable(action, { hasInvoiced: true }),
      ),
    ).toEqual(['delete'])
  })
})
