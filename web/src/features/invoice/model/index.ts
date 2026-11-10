import { sample } from 'effector'

import { fetchInvoice, resetInvoice } from './events'
import {
  $hasMoreInvoices,
  $invoiceLastListParams,
  $invoicePage,
  $invoiceProjectFilter,
  $invoiceListFilter,
  $invoiceReloadThroughPage,
  $invoiceSort,
  fetchInvoiceList,
  retryInvoiceList,
  retryInvoiceSummary,
  invoiceFilterChanged,
  invoiceFiltersReset,
  invoiceProjectFilterChanged,
  invoiceSortChanged,
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
  clock: [fetchInvoiceList, invoiceSortChanged, ...invoiceFilterChanged],
  source: {
    filter: $invoiceListFilter,
    sort: $invoiceSort,
    reloadThroughPage: $invoiceReloadThroughPage,
  },
  fn: ({ filter, sort, reloadThroughPage }) => ({
    ...filter,
    sort,
    page: 0,
    ...(reloadThroughPage === null ? {} : { reloadThroughPage }),
  }),
  target: invoiceListQuery.start,
})

sample({
  clock: loadMoreInvoices,
  source: {
    filter: $invoiceListFilter,
    sort: $invoiceSort,
    page: $invoicePage,
    hasMore: $hasMoreInvoices,
    pending: invoiceListQuery.$pending,
    failed: invoiceListQuery.$failed,
  },
  // Guarded rather than trusted to the page: reaching the end again mid-request
  // would otherwise fire the same page twice.
  filter: ({ hasMore, pending, failed }) => hasMore && !pending && !failed,
  fn: ({ filter, sort, page }) => ({
    ...filter,
    sort,
    page: page + 1,
  }),
  target: invoiceListQuery.start,
})

sample({
  clock: retryInvoiceList,
  source: $invoiceLastListParams,
  filter: Boolean,
  target: invoiceListQuery.start,
})

// The strip follows the project filter only; the others narrow the rows
// underneath it, not the totals they are a slice of. Settling an invoice moves
// money from one figure to the other, so that re-reads it too.
sample({
  clock: [
    fetchInvoiceList,
    retryInvoiceSummary,
    invoiceProjectFilterChanged,
    invoiceFiltersReset,
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
export {
  $invoice,
  $invoiceTime,
  $invoiceLoading,
  $invoiceFailure,
} from './stores'
export { buildInvoiceHead, type InvoiceHead } from './head'
export type { InvoiceRead, InvoiceReport, ProjectInvoice } from './types'
export {
  INVOICE_PAGE_SIZE,
  invoiceListQuery,
  invoiceProjectsQuery,
  invoiceQuery,
  invoiceSummaryQuery,
} from './queries'
export {
  $hasMoreInvoices,
  $invoiceAmountFilter,
  $invoiceHasActiveFilters,
  $invoicePage,
  $invoicePeriodFilter,
  $invoiceProjectFilter,
  $invoiceSort,
  $invoiceStateFilter,
  $invoiceSummary,
  $invoiceSummaryLoading,
  $invoiceSummaryFailed,
  $invoices,
  $invoicesTotal,
  $isLoadingMoreInvoices,
  fetchInvoiceList,
  retryInvoiceList,
  retryInvoiceSummary,
  invoiceAmountFilterChanged,
  invoiceFiltersReset,
  invoicePeriodFilterChanged,
  invoiceProjectFilterChanged,
  invoiceSortChanged,
  invoiceStateFilterChanged,
  loadMoreInvoices,
  type InvoiceStateFilter,
  type InvoiceSummary,
} from './list.stores'
export { isInvoiceAmountInput } from './invoice-filter'
export {
  INVOICE_SORT_FIELDS,
  type InvoiceSort,
  type InvoiceSortField,
  type InvoiceSortOrder,
} from './invoice-sort'
export {
  DEFAULT_WORKLOG_SORT,
  WORKLOG_SORT_FIELDS,
  sortInvoiceWorklogs,
  type WorklogSort,
  type WorklogSortField,
} from './worklog-sort'
export * from './format'
export * from './mutations'
export * from './settlement.model'
export { getInvoicePageUrl, type InvoiceActionsLayout } from './invoice-actions'
export * from './invoice-actions.model'

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
export * from './worklog-paging'
