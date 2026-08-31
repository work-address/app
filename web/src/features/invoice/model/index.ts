import { sample } from 'effector'

import { fetchInvoice, resetInvoice } from './events'
import { ensureInvoiceMutation, invoiceSelectedTimeMutation } from './mutations'
import { invoiceQuery } from './queries'

import { routes } from '@/routes'
import { navigateFx, showToastFx } from '@/shared'

// `fetchInvoice` carries an INVOICE id. One request serves the whole page: the
// invoice is authoritative for the amount, period and state, and carries the
// time it bills along with the roll-up of that time.
sample({
  clock: fetchInvoice,
  fn: ({ id }) => id,
  target: invoiceQuery.start,
})

sample({
  clock: resetInvoice,
  target: invoiceQuery.reset,
})

export { fetchInvoice, resetInvoice } from './events'
export { $invoice, $invoiceTime, $invoiceLoading } from './stores'
export type { InvoiceRead, InvoiceReport, ProjectInvoice } from './types'
export { invoiceListQuery, invoiceQuery } from './queries'
export * from './format'
export * from './mutations'

/**
 * Opening a project's invoice navigates to whatever the server ensured.
 *
 * Routed here rather than from the component: the router is a module singleton
 * and `navigateFx` is designed to be a sample target, so the redirect does not
 * need a mounted component to survive.
 */
type EnsuredInvoice = { id?: string } | null

// Both routes to an invoice land on the same page.
sample({
  clock: [
    ensureInvoiceMutation.finished.success,
    invoiceSelectedTimeMutation.finished.success,
  ],
  filter: ({ result }: { result: EnsuredInvoice }) => Boolean(result?.id),
  fn: ({ result }: { result: EnsuredInvoice }) => ({
    to: routes.invoice.build({ id: result?.id as string }),
  }),
  target: navigateFx,
})

/** Nothing tracked yet means nothing to bill for - say so rather than opening
 * an empty invoice the user has to interpret. */
sample({
  clock: ensureInvoiceMutation.finished.success,
  filter: ({ result }: { result: EnsuredInvoice }) => !result?.id,
  fn: () => ({
    type: 'info' as const,
    messageKey: 'invoice.open.nothingToInvoice',
    position: 'top-center' as const,
  }),
  target: showToastFx,
})
