import { createEvent } from 'effector'

import type { InvoiceFilter, InvoiceSettlement } from './invoice-feed'

/** isPaid is the requested state, never a request to toggle an unknown state. */
export const invoiceSettlementRequested = createEvent<{
  id: string
  isPaid: boolean
}>()
export const invoiceSettlementApplied = createEvent<{
  invoice: InvoiceSettlement
  filter: InvoiceFilter
  removed: boolean
}>()
