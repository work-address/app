import { merge, sample } from 'effector'

import { matchesInvoiceFilter } from './invoice-feed'
import {
  $invoicePage,
  $invoiceProjectFilter,
  $invoiceStateFilter,
  $invoices,
} from './list.stores'
import { markInvoicePaidMutation, markInvoiceUnpaidMutation } from './mutations'
import { invoiceListQuery } from './queries'
import {
  invoiceSettlementApplied,
  invoiceSettlementRequested,
} from './settlement.events'
import { $invoiceSettlementPendingIds } from './settlement.stores'

import { showToastFx, suppressGlobalErrorToast } from '@/shared'

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
const settlementFailed = merge([
  markInvoicePaidMutation.finished.failure,
  markInvoiceUnpaidMutation.finished.failure,
])
settlementFailed.watch(({ error }) => suppressGlobalErrorToast(error))

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
  clock: settlementFailed,
  fn: () => ({ type: 'error' as const, messageKey: 'invoice.payment.failed' }),
  target: showToastFx,
})
sample({
  clock: settlementSucceeded,
  source: {
    items: $invoices,
    projectId: $invoiceProjectFilter,
    state: $invoiceStateFilter,
  },
  fn: ({ items, projectId, state }, { result }) => {
    const filter = {
      projectId: projectId || undefined,
      state: state || undefined,
    }
    return {
      invoice: result,
      filter,
      removed:
        items.some((item) => item.id === result.id) &&
        !matchesInvoiceFilter(result, filter),
    }
  },
  target: invoiceSettlementApplied,
})

// A state change shifts offset pages. Rebuild every previously loaded page,
// atomically, rather than dropping them or assuming one tail page is enough.
sample({
  clock: settlementSucceeded,
  source: {
    projectId: $invoiceProjectFilter,
    state: $invoiceStateFilter,
    page: $invoicePage,
  },
  filter: ({ state }) => Boolean(state),
  fn: ({ projectId, state, page }) => ({
    projectId: projectId || undefined,
    state: state || undefined,
    page: 0,
    reloadThroughPage: page,
  }),
  target: invoiceListQuery.start,
})

export { invoiceSettlementRequested } from './settlement.events'
export { $invoiceSettlementPendingIds } from './settlement.stores'
