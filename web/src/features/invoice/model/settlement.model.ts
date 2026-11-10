import { merge, sample } from 'effector'

import { matchesInvoiceFilter } from './invoice-feed'
import {
  $invoiceListFilter,
  $invoicePage,
  $invoiceSort,
  $invoices,
} from './list.stores'
import { markInvoicePaidMutation, markInvoiceUnpaidMutation } from './mutations'
import { invoiceListQuery } from './queries'
import {
  invoiceSettlementApplied,
  invoiceSettlementRequested,
} from './settlement.events'
import { $invoiceSettlementPendingIds } from './settlement.stores'

import { showToastFx } from '@/shared'

sample({
  clock: invoiceSettlementRequested,
  source: $invoiceSettlementPendingIds,
  filter: (pending, request) =>
    Boolean(request.id) && request.isPaid && !pending[request.id],
  fn: (_, request) => request.id,
  target: markInvoicePaidMutation.start,
})
sample({
  clock: invoiceSettlementRequested,
  source: $invoiceSettlementPendingIds,
  filter: (pending, request) =>
    Boolean(request.id) && !request.isPaid && !pending[request.id],
  fn: (_, request) => request.id,
  target: markInvoiceUnpaidMutation.start,
})

const settlementSucceeded = merge([
  markInvoicePaidMutation.finished.success,
  markInvoiceUnpaidMutation.finished.success,
])

sample({
  clock: settlementSucceeded,
  fn: ({ result }) => ({
    type: 'success' as const,
    messageKey:
      result.state === 'PAID'
        ? 'invoice.payment.markedPaid'
        : 'invoice.payment.markedUnpaid',
  }),
  target: showToastFx,
})
sample({
  clock: settlementSucceeded,
  source: { items: $invoices, filter: $invoiceListFilter },
  fn: ({ items, filter }, { result }) => ({
    invoice: result,
    filter,
    removed:
      items.some((item) => item.id === result.id) &&
      !matchesInvoiceFilter(result, filter),
  }),
  target: invoiceSettlementApplied,
})

// A state change shifts offset pages. Rebuild every previously loaded page,
// atomically, rather than dropping them or assuming one tail page is enough.
sample({
  clock: settlementSucceeded,
  source: {
    filter: $invoiceListFilter,
    sort: $invoiceSort,
    page: $invoicePage,
  },
  // Sorted by status, a settled row belongs elsewhere in the list too.
  filter: ({ filter, sort }) => Boolean(filter.state) || Boolean(sort.state),
  fn: ({ filter, sort, page }) => ({
    ...filter,
    sort,
    page: 0,
    reloadThroughPage: page,
  }),
  target: invoiceListQuery.start,
})

export { invoiceSettlementRequested } from './settlement.events'
export { $invoiceSettlementPendingIds } from './settlement.stores'
