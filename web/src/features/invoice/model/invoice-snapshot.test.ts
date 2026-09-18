import { describe, expect, it } from 'vitest'

import {
  describeInvoiceRate,
  getInvoiceRateCents,
  getInvoiceTimeRows,
} from './invoice-snapshot'

import type { InvoiceRead } from './types'

/** Returns the key, so an assertion can say which message was chosen. */
const t = (key: string) => key

/**
 * An invoice issued at $20/h whose project has since gone to $50/h: the read
 * endpoint returns the project as it is now beside the invoice's snapshot.
 */
const issuedAtTwenty: InvoiceRead = {
  id: 'invoice',
  amountCents: '3000',
  rateHourCents: 2000,
  project: { rateHour: '50.00' } as InvoiceRead['project'],
  report: { rateHour: 20, rateTotal: 30 },
  lines: [
    {
      timeId: 'first',
      fromAt: '2026-09-01T09:00:00.000Z',
      toAt: '2026-09-01T09:30:00.000Z',
      minutesActive: 30,
    },
    {
      timeId: 'second',
      fromAt: '2026-09-01T09:30:00.000Z',
      toAt: '2026-09-01T10:00:00.000Z',
      minutesActive: 60,
    },
  ],
  time: [
    // Re-synced since issuance: the entry now claims 5 active minutes.
    {
      id: 'second',
      note: 'wrote the report',
      keyboardKeys: 7,
      minutesActive: 5,
      fromAt: '2026-09-01T09:30:00.000Z',
      toAt: '2026-09-01T09:40:00.000Z',
    },
  ],
}

/** Issued before snapshots: no rate on record, the project now at $60/h. */
const legacy: InvoiceRead = {
  id: 'legacy',
  amountCents: '5000',
  rateHourCents: null as unknown as undefined,
  project: { rateHour: '60.00' } as InvoiceRead['project'],
  report: { rateHour: null, rateTotal: null },
  lines: null,
  time: [{ id: 'old', minutesActive: 42, note: 'before snapshots' }],
}

describe('describeInvoiceRate', () => {
  it('shows the rate the invoice was issued at, not the project rate now', () => {
    expect(describeInvoiceRate(issuedAtTwenty, t)).toEqual({
      value: '$20.00',
      desc: 'invoice.metricDesc.rateHour',
    })
  })

  it('shows no rate on a legacy invoice rather than borrowing one', () => {
    const field = describeInvoiceRate(legacy, t)

    expect(field).toEqual({
      value: 'invoice.fields.rateNotRecorded',
      desc: 'invoice.metricDesc.rateNotRecorded',
    })
    expect(field.value).not.toContain('60')
  })

  it('is blank while the invoice loads', () => {
    expect(describeInvoiceRate(null, t).value).toBe('')
  })
})

describe('getInvoiceRateCents', () => {
  it('reads the snapshot column only', () => {
    expect(getInvoiceRateCents(issuedAtTwenty)).toBe(2000)
    expect(getInvoiceRateCents(legacy)).toBeNull()
    expect(getInvoiceRateCents({})).toBeNull()
  })
})

describe('getInvoiceTimeRows', () => {
  it('prints the billed lines with what they billed, in snapshot order', () => {
    const rows = getInvoiceTimeRows(issuedAtTwenty)

    expect(rows.map((row) => row.id)).toEqual(['first', 'second'])
    expect(rows.map((row) => row.minutesActive)).toEqual([30, 60])
    expect(rows[1]).toMatchObject({
      fromAt: '2026-09-01T09:30:00.000Z',
      toAt: '2026-09-01T10:00:00.000Z',
      note: 'wrote the report',
      keyboardKeys: 7,
    })
  })

  it('still prints a line whose entry is no longer linked', () => {
    expect(getInvoiceTimeRows(issuedAtTwenty)[0]).toEqual({
      id: 'first',
      fromAt: '2026-09-01T09:00:00.000Z',
      toAt: '2026-09-01T09:30:00.000Z',
      minutesActive: 30,
    })
  })

  it('shows a legacy invoice its linked entries as they are', () => {
    expect(getInvoiceTimeRows(legacy)).toEqual(legacy.time)
  })

  it('has no rows before the invoice loads', () => {
    expect(getInvoiceTimeRows(null)).toEqual([])
  })
})
