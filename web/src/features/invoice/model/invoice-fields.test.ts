import { describe, expect, it } from 'vitest'

import { getInvoiceInfoFields } from './invoice-fields'

import type { TFunction } from 'i18next'

const t = ((key: string) => key) as unknown as TFunction

const report = {
  rateHour: 20,
  rateTotal: 20,
  minutes: 60,
  minutesActive: 60,
  minutesPaid: 0,
  minutesUnpaid: 60,
  keyboardKeys: 10,
  mouseKeys: 5,
  mouseDistance: 100,
}

describe('getInvoiceInfoFields', () => {
  it('lists the hours and activity an hourly invoice billed', () => {
    const fields = getInvoiceInfoFields(
      {
        createdAt: '2026-09-01T10:00:00.000Z',
        basis: 'HOURLY',
        rateHourCents: 2000,
        report,
      },
      t,
    )

    expect(fields.map((field) => field.id)).toEqual([
      'issueDate',
      'rateHour',
      'timeTotal',
      'timeActive',
      'timePaid',
      'timeUnpaid',
      'keyboard',
      'mouse',
      'mouseDistance',
    ])
    expect(fields[1].value).toBe('$20.00')
  })

  /**
   * A fixed-price invoice has no time behind it: rows of zero hours would
   * read as a bill for no work, so it shows only what it has.
   */
  it('shows a fixed-price invoice as fixed, with no hour or activity rows', () => {
    const fields = getInvoiceInfoFields(
      {
        createdAt: '2026-09-01T10:00:00.000Z',
        basis: 'FIXED',
        rateHourCents: 0,
        report: {
          ...report,
          rateHour: null,
          rateTotal: null,
          minutes: 0,
          minutesActive: 0,
          minutesUnpaid: 0,
        },
      },
      t,
    )

    expect(fields.map((field) => field.id)).toEqual(['issueDate', 'rateHour'])
    expect(fields[1]).toEqual({
      id: 'rateHour',
      value: 'invoice.fields.rateFixed',
      desc: 'invoice.metricDesc.rateFixed',
    })
  })
})
