import { describe, expect, it } from 'vitest'

import { getInvoiceDocumentFields } from './invoice-document'

import type { InvoiceDocumentSource } from './invoice-document'

const t = (key: string, params?: Record<string, unknown>) =>
  params ? `${key}:${JSON.stringify(params)}` : key

const formatDate = (date: Date) => date.toISOString().slice(0, 10)

const ISSUER = '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc'
const OWNER = '0x70997970c51812dc3a010c7d01b50e0d17dc79c8'

/** A paid hourly invoice with its v1 snapshot, as the read returns it. */
const paid: InvoiceDocumentSource = {
  id: '4e61ff62-5642-478f-901b-f7be07550426',
  fromAt: '2026-09-01T09:00:00.000Z',
  toAt: '2026-09-07T17:00:00.000Z',
  amountCents: '3000',
  currency: 'USD',
  issuerAddress: ISSUER,
  ownerAddress: OWNER,
  state: 'PAID',
  paidAt: '2026-09-10T12:00:00.000Z',
  user: { name: 'Ada Lovelace', address: '0xnowadifferentwallet' },
  project: { user: { name: 'Analytical Engines Ltd', address: OWNER } },
}

const byId = (fields: ReturnType<typeof getInvoiceDocumentFields>) =>
  Object.fromEntries(fields.map((field) => [field.id, field]))

describe('getInvoiceDocumentFields', () => {
  /** WP-99: the printed invoice states every fact the snapshot holds. */
  it('states who, to whom, which invoice, what period, currency, amount and state', () => {
    const fields = byId(getInvoiceDocumentFields(paid, { t, formatDate }))

    expect(Object.keys(fields)).toEqual([
      'from',
      'billTo',
      'reference',
      'period',
      'currency',
      'amount',
      'status',
      'paidOn',
    ])
    expect(fields.from).toMatchObject({ value: 'Ada Lovelace', detail: ISSUER })
    expect(fields.billTo).toMatchObject({
      value: 'Analytical Engines Ltd',
      detail: OWNER,
    })
    expect(fields.reference.value).toBe(paid.id)
    expect(fields.period.value).toBe(
      'invoice.document.periodRange:{"from":"2026-09-01","to":"2026-09-07"}',
    )
    expect(fields.currency.value).toBe('USD')
    expect(fields.amount.value).toBe('$30.00')
    expect(fields.status.value).toBe('invoice.state.paid')
    expect(fields.paidOn.value).toBe('2026-09-10')
  })

  /**
   * The addresses are the ones frozen at issuance: the issuer has changed
   * wallets since, and the document still names the one it was billed from.
   */
  it('prints the snapshot addresses, not the accounts as they are now', () => {
    const fields = byId(getInvoiceDocumentFields(paid, { t, formatDate }))

    expect(fields.from.detail).toBe(ISSUER)
    expect(fields.from.detail).not.toBe(paid.user?.address)
  })

  it('falls back to the accounts on an invoice issued before snapshots', () => {
    const fields = byId(
      getInvoiceDocumentFields(
        {
          ...paid,
          issuerAddress: undefined,
          ownerAddress: undefined,
          currency: undefined,
        },
        { t, formatDate },
      ),
    )

    expect(fields.from.detail).toBe('0xnowadifferentwallet')
    expect(fields.billTo.detail).toBe(OWNER)
    expect(fields.currency.value).toBe('USD')
  })

  it('has no paid date until it is paid, and says it is awaiting payment', () => {
    const fields = byId(
      getInvoiceDocumentFields(
        { ...paid, state: 'REQUESTED', paidAt: undefined },
        { t, formatDate },
      ),
    )

    expect(fields.paidOn).toBeUndefined()
    expect(fields.status.value).toBe('invoice.state.requested')
  })

  it('says a refunded escrow bill was refunded', () => {
    const fields = byId(
      getInvoiceDocumentFields(
        {
          ...paid,
          state: 'REQUESTED',
          paidAt: undefined,
          escrowState: 'DISPUTED_REFUNDED',
        },
        { t, formatDate },
      ),
    )

    expect(fields.status.value).toBe('invoice.state.refunded')
  })

  it('names the milestone a fixed-price bill is for, and the invoice an adjustment corrects', () => {
    const fields = byId(
      getInvoiceDocumentFields(
        {
          ...paid,
          milestoneRef: 'milestone-2',
          correctsInvoiceId: 'a0000000-0000-4000-8000-000000000000',
        },
        { t, formatDate },
      ),
    )

    expect(fields.milestone.value).toBe('milestone-2')
    expect(fields.corrects.value).toBe('a0000000-0000-4000-8000-000000000000')
  })

  it('says a party has no name rather than printing a blank', () => {
    const fields = byId(
      getInvoiceDocumentFields(
        { ...paid, user: { address: ISSUER }, project: { user: null } },
        { t, formatDate },
      ),
    )

    expect(fields.from.value).toBe('invoice.document.unnamed')
    expect(fields.billTo.value).toBe('invoice.document.unnamed')
    expect(fields.billTo.detail).toBe(OWNER)
  })

  it('is empty while nothing is loaded', () => {
    expect(getInvoiceDocumentFields(null, { t, formatDate })).toEqual([])
  })
})
