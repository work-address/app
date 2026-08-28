import { sample } from 'effector'

import { fetchInvoice, resetInvoice } from './events'
import { ensureInvoiceMutation } from './mutations'
import {
  activityDetailQuery,
  activityReportQuery,
  invoiceQuery,
} from './queries'

import { routes } from '@/routes'
import { navigateFx, showToastFx } from '@/shared'

// `fetchInvoice` carries an INVOICE id. The invoice is authoritative for the
// amount, period and state; the project and time report are fetched afterwards,
// from the project the invoice names, purely for the breakdown beneath it.
sample({
  clock: fetchInvoice,
  fn: ({ id }) => id,
  target: invoiceQuery.start,
})

sample({
  clock: invoiceQuery.$data,
  filter: (invoice) => Boolean(invoice?.project?.id),
  fn: (invoice) => invoice?.project?.id as string,
  target: [activityDetailQuery.start, activityReportQuery.start],
})

sample({
  clock: resetInvoice,
  target: [
    invoiceQuery.reset,
    activityDetailQuery.reset,
    activityReportQuery.reset,
  ],
})

export { fetchInvoice, resetInvoice } from './events'
export { $invoice, $invoiceTime, $invoiceLoading } from './stores'
export type { ProjectInvoice } from './types'
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

sample({
  clock: ensureInvoiceMutation.finished.success,
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
