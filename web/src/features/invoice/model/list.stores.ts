import { combine, createEvent, createStore, sample } from 'effector'
import { debounce } from 'patronum/debounce'

import { applyInvoiceSettlement } from './invoice-feed'
import {
  buildInvoiceListFilter,
  EMPTY_INVOICE_AMOUNT,
  EMPTY_INVOICE_PERIOD,
  isSameInvoiceAmount,
  type InvoiceAmountFilter,
  type InvoicePeriodFilter,
} from './invoice-filter'
import { DEFAULT_INVOICE_SORT, type InvoiceSort } from './invoice-sort'
import { invoiceListQuery, invoiceSummaryQuery } from './queries'
import { invoiceSettlementApplied } from './settlement.events'

import type { InvoiceListParams } from './queries'
import type { baseApi } from '@/shared'

export const fetchInvoiceList = createEvent()
export const retryInvoiceSummary = createEvent()
export const loadMoreInvoices = createEvent()
export const retryInvoiceList = createEvent()
export const invoiceProjectFilterChanged = createEvent<string>()
export const invoiceSortChanged = createEvent<InvoiceSort>()

/** Empty string means "every state" - what the list opens on. */
export type InvoiceStateFilter = '' | 'PAID' | 'Requested' | 'REJECTED'

export const invoiceStateFilterChanged = createEvent<InvoiceStateFilter>()
export const invoicePeriodFilterChanged =
  createEvent<Partial<InvoicePeriodFilter>>()
export const invoiceAmountFilterChanged =
  createEvent<Partial<InvoiceAmountFilter>>()
export const invoiceFiltersReset = createEvent()

/** Empty string means "every project" - the filter's default. */
export const $invoiceProjectFilter = createStore('')
  .on(invoiceProjectFilterChanged, (_, projectId) => projectId)
  .reset(invoiceFiltersReset)

export const $invoiceStateFilter = createStore<InvoiceStateFilter>('')
  .on(invoiceStateFilterChanged, (_, state) => state)
  .reset(invoiceFiltersReset)

export const $invoicePeriodFilter = createStore(EMPTY_INVOICE_PERIOD)
  .on(invoicePeriodFilterChanged, (period, change) => ({
    ...period,
    ...change,
  }))
  .reset(invoiceFiltersReset)

/** What the inputs show, updated on every key. */
export const $invoiceAmountFilter = createStore(EMPTY_INVOICE_AMOUNT)
  .on(invoiceAmountFilterChanged, (amount, change) => ({
    ...amount,
    ...change,
  }))
  .reset(invoiceFiltersReset)

const INVOICE_AMOUNT_DEBOUNCE_MS = 400

/** What the list asks for: the amount once typing stops. */
const $invoiceAppliedAmount = createStore(EMPTY_INVOICE_AMOUNT)

// Reads the inputs when the wait ends rather than carrying what was typed, so
// typing cut short by a reset cannot bring the old amount back; and only a
// different figure counts, so "12" to "12." or that same reset reload nothing.
const invoiceAmountFilterSettled = sample({
  clock: debounce(invoiceAmountFilterChanged, INVOICE_AMOUNT_DEBOUNCE_MS),
  source: { typed: $invoiceAmountFilter, applied: $invoiceAppliedAmount },
  filter: ({ typed, applied }) => !isSameInvoiceAmount(typed, applied),
  fn: ({ typed }) => typed,
})

$invoiceAppliedAmount
  .on(invoiceAmountFilterSettled, (_, amount) => amount)
  .reset(invoiceFiltersReset)

/** Every filter as the search endpoint takes it. */
export const $invoiceListFilter = combine(
  {
    projectId: $invoiceProjectFilter,
    state: $invoiceStateFilter,
    period: $invoicePeriodFilter,
    amount: $invoiceAppliedAmount,
  },
  buildInvoiceListFilter,
)

export const $invoiceHasActiveFilters = $invoiceListFilter.map(
  (filter) => Object.keys(filter).length > 0,
)

/**
 * Not one of the filters below: the same invoices in another order. The rows
 * stay on screen until the new first page replaces them, as they do when the
 * worklogs are re-sorted, rather than dropping to skeletons.
 */
export const $invoiceSort = createStore<InvoiceSort>(DEFAULT_INVOICE_SORT).on(
  invoiceSortChanged,
  (_, sort) => sort,
)

/** Any filter describes a different query, so each starts the list over. */
export const invoiceFilterChanged = [
  invoiceProjectFilterChanged,
  invoiceStateFilterChanged,
  invoicePeriodFilterChanged,
  invoiceAmountFilterSettled,
  invoiceFiltersReset,
]

type InvoiceFeed = {
  items: baseApi.InvoiceSearch[]
  /** A page that added nothing new: stop offering to load further. */
  endReached: boolean
}

const emptyFeed: InvoiceFeed = { items: [], endReached: false }

/**
 * Pages accumulate here rather than replacing one another, so scrolling to the
 * end grows the list instead of swapping it.
 *
 * Changing a filter resets it: the pages already loaded describe a different
 * query, and appending the new ones would mix two filters in one list.
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
 * place of the list, a later one only a spinner at the bottom.
 */
// A failed prefix reload remembers its span, so retry preserves loaded pages.
export const $invoiceReloadThroughPage = createStore<number | null>(null)
  .on(invoiceListQuery.start, (_, params) => params.reloadThroughPage ?? null)
  .on(invoiceListQuery.finished.success, () => null)
  // The new order starts from its first page, whatever the old one had loaded.
  .reset([...invoiceFilterChanged, invoiceSortChanged])

/**
 * What the list last asked for, so a retry asks for exactly that again: the page
 * that failed, under the filter it failed with, and not the first page over.
 */
export const $invoiceLastListParams = createStore<InvoiceListParams | null>(
  null,
).on(invoiceListQuery.start, (_, params) => params)

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
 * not the others - they narrow the rows, the strip is what they narrow from.
 */
export const $invoiceSummary = invoiceSummaryQuery.$data.map(
  (items): InvoiceSummary =>
    (items ?? []).reduce((acc, item) => {
      if (item.state === 'REJECTED') {
        return acc
      }
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
