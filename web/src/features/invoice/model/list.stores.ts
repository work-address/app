import { combine, createEvent, createStore } from 'effector'

import { applyInvoiceSettlement } from './invoice-feed'
import { invoiceListQuery, invoiceSummaryQuery } from './queries'
import { invoiceSettlementApplied } from './settlement.events'

import type { baseApi } from '@/shared'

export const fetchInvoiceList = createEvent()
export const retryInvoiceSummary = createEvent()
export const loadMoreInvoices = createEvent()
export const invoiceProjectFilterChanged = createEvent<string>()

/** Empty string means "every state" - the tab the list opens on. */
export type InvoiceStateFilter = '' | 'PAID' | 'Requested'

export const invoiceStateFilterChanged = createEvent<InvoiceStateFilter>()

/** Empty string means "every project" - the filter's default. */
export const $invoiceProjectFilter = createStore('').on(
  invoiceProjectFilterChanged,
  (_, projectId) => projectId,
)

export const $invoiceStateFilter = createStore<InvoiceStateFilter>('').on(
  invoiceStateFilterChanged,
  (_, state) => state,
)

/** Either filter describes a different query, so both start the list over. */
export const invoiceFilterChanged = [
  invoiceProjectFilterChanged,
  invoiceStateFilterChanged,
]

type InvoiceFeed = {
  items: baseApi.InvoiceSearch[]
  /** A page that added nothing new: stop offering to load further. */
  endReached: boolean
}

const emptyFeed: InvoiceFeed = { items: [], endReached: false }

/**
 * Pages accumulate here rather than replacing one another, so "load more"
 * grows the list instead of swapping it.
 *
 * Changing the project filter resets it: the pages already loaded describe a
 * different query, and appending the new ones would mix two filters in one
 * list.
 */
export const $invoiceFeed = createStore<InvoiceFeed>(emptyFeed)
  .on(invoiceListQuery.finished.success, (feed, { params, result }) => {
    if (params.page === 0 || params.reloadThroughPage !== undefined) {
      return {
        items: result.items,
        endReached: result.items.length >= result.total,
      }
    }

    // Deduplicated by id: rows shift between pages when an invoice is raised
    // while the list is open, and an offset query would otherwise repeat one.
    const seen = new Set(feed.items.map((item) => item.id))
    const fresh = result.items.filter(
      (item) => item.id != null && !seen.has(item.id),
    )

    return {
      items: fresh.length > 0 ? [...feed.items, ...fresh] : feed.items,
      endReached: fresh.length === 0,
    }
  })
  .on(invoiceSettlementApplied, (feed, { invoice, filter }) => ({
    ...feed,
    items: applyInvoiceSettlement(feed.items, invoice, filter),
  }))
  .reset(invoiceFilterChanged)

export const $invoices = $invoiceFeed.map((feed) => feed.items)

export const $invoicesTotal = createStore(0)
  .on(invoiceListQuery.finished.success, (_, { result }) => result.total)
  .on(invoiceSettlementApplied, (total, { removed }) =>
    removed ? Math.max(0, total - 1) : total,
  )
  .reset(invoiceFilterChanged)

/** The last page the server actually answered for, so the next is page + 1. */
export const $invoicePage = createStore(0)
  .on(invoiceListQuery.finished.success, (_, { result }) => result.page)
  .reset(invoiceFilterChanged)

export const $hasMoreInvoices = combine(
  $invoiceFeed,
  $invoicesTotal,
  (feed, total) => !feed.endReached && feed.items.length < total,
)

/**
 * Distinguishes the first load from a later page: the first shows skeletons in
 * place of the list, a later one only disables the button at the bottom.
 */
// A failed prefix reload remembers its span, so retry preserves loaded pages.
export const $invoiceReloadThroughPage = createStore<number | null>(null)
  .on(invoiceListQuery.start, (_, params) => params.reloadThroughPage ?? null)
  .on(invoiceListQuery.finished.success, () => null)
  .reset(invoiceFilterChanged)

const $invoiceRequestedPage = createStore({ page: 0, reload: false })
  .on(invoiceListQuery.start, (_, params) => ({
    page: params.page,
    reload: params.reloadThroughPage !== undefined,
  }))
  .reset(invoiceFilterChanged)

export const $isLoadingMoreInvoices = combine(
  invoiceListQuery.$pending,
  $invoiceRequestedPage,
  (pending, request) => pending && (request.page > 0 || request.reload),
)

export type InvoiceSummary = {
  paidCents: number
  paidCount: number
  requestedCents: number
  requestedCount: number
  totalCents: number
  totalCount: number
}

const emptySummary: InvoiceSummary = {
  paidCents: 0,
  paidCount: 0,
  requestedCents: 0,
  requestedCount: 0,
  totalCents: 0,
  totalCount: 0,
}

/**
 * What the visible invoices add up to, split by whether the money arrived.
 *
 * Reduced from its own unpaged query rather than from the list, which holds
 * one page at a time: a total built from the first twenty rows would be
 * wrong the moment there was a twenty-first. Follows the project filter but
 * not the state tab - the tab narrows the rows, the strip is what they narrow
 * from.
 */
export const $invoiceSummary = invoiceSummaryQuery.$data.map(
  (items): InvoiceSummary =>
    (items ?? []).reduce((acc, item) => {
      const cents = Math.trunc(Number(item.amountCents ?? 0)) || 0
      const paid = item.state === 'PAID'

      return {
        paidCents: acc.paidCents + (paid ? cents : 0),
        paidCount: acc.paidCount + (paid ? 1 : 0),
        requestedCents: acc.requestedCents + (paid ? 0 : cents),
        requestedCount: acc.requestedCount + (paid ? 0 : 1),
        totalCents: acc.totalCents + cents,
        totalCount: acc.totalCount + 1,
      }
    }, emptySummary),
)

// Hide an earlier filter's figures during refresh instead of showing stale sums.
export const $invoiceSummaryLoading = invoiceSummaryQuery.$pending
export const $invoiceSummaryFailed = invoiceSummaryQuery.$failed
