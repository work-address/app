import { combine, createEvent, createStore } from 'effector'

import { markInvoicePaidMutation, markInvoiceUnpaidMutation } from './mutations'
import { invoiceListQuery, invoiceSummaryQuery } from './queries'

import type { baseApi } from '@/shared'

export const fetchInvoiceList = createEvent()
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
    if (params.page === 0) {
      return { items: result.items, endReached: result.items.length === 0 }
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
  // Settling an invoice patches the row in place. Refetching would drop every
  // page loaded after the first and jump the reader back to the top.
  .on(
    [
      markInvoicePaidMutation.finished.success,
      markInvoiceUnpaidMutation.finished.success,
    ],
    (feed, { params }) => ({
      ...feed,
      items: feed.items.map((item) => {
        if (item.id !== params) {
          return item
        }

        const settled = item.state !== 'PAID'

        return {
          ...item,
          state: settled ? 'PAID' : 'Requested',
          // Cleared rather than set to null: the field is optional in the
          // response, and a null would render as a date of "1 Jan 1970".
          paidAt: settled ? new Date().toISOString() : undefined,
        }
      }),
    }),
  )
  .reset(invoiceFilterChanged)

export const $invoices = $invoiceFeed.map((feed) => feed.items)

export const $invoicesTotal = createStore(0)
  .on(invoiceListQuery.finished.success, (_, { result }) => result.total)
  .reset(invoiceFilterChanged)

/** The last page the server actually answered for, so the next is page + 1. */
export const $invoicePage = createStore(0)
  .on(invoiceListQuery.finished.success, (_, { params }) => params.page)
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
export const $isLoadingMoreInvoices = createStore(false)
  .on(invoiceListQuery.start, (_, params) => params.page > 0)
  .on(invoiceListQuery.finished.finally, () => false)
  .reset(invoiceFilterChanged)

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

export const $invoiceSummaryLoading = combine(
  invoiceSummaryQuery.$pending,
  invoiceSummaryQuery.$data,
  (pending, data) => pending && data === null,
)
