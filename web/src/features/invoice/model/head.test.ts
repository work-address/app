import { describe, expect, it } from 'vitest'

import { buildInvoiceHead } from './head'

// Echoes the key and its params, so the tests read which copy was chosen
// and what was filled into it.
const t = (key: string, params?: Record<string, unknown>) =>
  params ? `${key} ${JSON.stringify(params)}` : key

describe('buildInvoiceHead', () => {
  it('names the tab after the project the invoice bills', () => {
    const head = buildInvoiceHead(
      { project: 'Bike', amount: '$5,190.90', isPaid: true },
      t,
    )

    expect(head.title).toBe('invoice.page.documentTitle {"project":"Bike"}')
    expect(head.description).toBe(
      'invoice.page.meta {"project":"Bike","amount":"$5,190.90","state":"invoice.state.paid"}',
    )
  })

  it('describes an unpaid invoice as awaiting payment', () => {
    const head = buildInvoiceHead({ project: 'Bike', amount: '$1.00' }, t)

    expect(head.description).toContain('invoice.state.requested')
  })

  it('falls back to the generic title while the record loads', () => {
    expect(buildInvoiceHead({}, t)).toEqual({
      title: 'app.documentTitle.invoice',
      description: 'invoice.page.metaGeneric',
    })
  })

  it('says not found for a missing invoice, whatever else is known', () => {
    expect(
      buildInvoiceHead({ project: 'Bike', failure: 'not-found' }, t).title,
    ).toBe('invoice.notFound.documentTitle')
  })
})
