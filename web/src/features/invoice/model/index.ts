import { sample } from 'effector'

import { fetchInvoice, resetInvoice } from './events'
import {
  $hasMoreInvoices,
  $invoicePage,
  $invoiceProjectFilter,
  $invoiceStateFilter,
  fetchInvoiceList,
  invoiceFilterChanged,
  invoiceProjectFilterChanged,
  loadMoreInvoices,
} from './list.stores'
import {
  ensureInvoiceMutation,
  invoiceSelectedTimeMutation,
  markInvoicePaidMutation,
  markInvoiceUnpaidMutation,
} from './mutations'
import { invoiceListQuery, invoiceQuery, invoiceSummaryQuery } from './queries'

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

// A first load, and every change of filter, start again from page 0.
sample({
  clock: [fetchInvoiceList, ...invoiceFilterChanged],
  source: { projectId: $invoiceProjectFilter, state: $invoiceStateFilter },
  fn: ({ projectId, state }) => ({
    projectId: projectId || undefined,
    state: state || undefined,
    page: 0,
  }),
  target: invoiceListQuery.start,
})

sample({
  clock: loadMoreInvoices,
  source: {
    projectId: $invoiceProjectFilter,
    state: $invoiceStateFilter,
    page: $invoicePage,
    hasMore: $hasMoreInvoices,
    pending: invoiceListQuery.$pending,
  },
  // Guarded rather than trusted to the button's disabled state: a double click
  // would otherwise fire the same page twice.
  filter: ({ hasMore, pending }) => hasMore && !pending,
  fn: ({ projectId, state, page }) => ({
    projectId: projectId || undefined,
    state: state || undefined,
    page: page + 1,
  }),
  target: invoiceListQuery.start,
})

// The strip follows the project filter only; the state tab narrows the rows
// underneath it, not the totals they are a slice of. Settling an invoice moves
// money from one figure to the other, so that re-reads it too.
sample({
  clock: [
    fetchInvoiceList,
    invoiceProjectFilterChanged,
    markInvoicePaidMutation.finished.success,
    markInvoiceUnpaidMutation.finished.success,
  ],
  source: $invoiceProjectFilter,
  fn: (projectId) => ({ projectId: projectId || undefined }),
  target: invoiceSummaryQuery.start,
})

// The invoice page shows the state it was opened with; settling from that page
// re-reads the record so the badge and the button agree with the server.
sample({
  clock: [
    markInvoicePaidMutation.finished.success,
    markInvoiceUnpaidMutation.finished.success,
  ],
  source: invoiceQuery.$data,
  filter: (invoice, { params }) =>
    Boolean(invoice?.id) && invoice?.id === params,
  fn: (invoice) => invoice?.id as string,
  target: invoiceQuery.start,
})

export { fetchInvoice, resetInvoice } from './events'
export { $invoice, $invoiceTime, $invoiceLoading } from './stores'
export type {
  InvoiceLine,
  InvoiceRead,
  InvoiceReport,
  ProjectInvoice,
} from './types'
export {
  INVOICE_PAGE_SIZE,
  invoiceListQuery,
  invoiceProjectsQuery,
  invoiceQuery,
  invoiceSummaryQuery,
} from './queries'
export {
  $hasMoreInvoices,
  $invoicePage,
  $invoiceProjectFilter,
  $invoiceStateFilter,
  $invoiceSummary,
  $invoiceSummaryLoading,
  $invoices,
  $invoicesTotal,
  $isLoadingMoreInvoices,
  fetchInvoiceList,
  invoiceProjectFilterChanged,
  invoiceStateFilterChanged,
  loadMoreInvoices,
  type InvoiceStateFilter,
  type InvoiceSummary,
} from './list.stores'
export * from './format'
export {
  describeInvoiceRate,
  getInvoiceRateCents,
  getInvoiceTimeRows,
  type InvoiceTimeRow,
} from './invoice-snapshot'
export {
  canMarkInvoiceByHand,
  describeInvoiceEscrow,
  formatTokenAmount,
  getInvoiceStatus,
  isEscrowBound,
  type InvoiceEscrowFields,
  type InvoiceEscrowLayout,
  type InvoiceEscrowView,
  type InvoiceEscrowState,
  type InvoiceStatus,
} from './invoice-escrow'
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
