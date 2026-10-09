import { concurrency, createQuery } from '@farfetched/core'

import { readLoadedInvoicePages } from './invoice-feed'

import type { InvoiceRead } from './types'

import { baseApi, collectSearchPages, runApiData } from '@/shared'

/**
 * The whole invoice page in one request: the persisted invoice, the time it
 * bills, and the roll-up of that time.
 *
 * The amount is read, never recomputed. A stored invoice is a frozen record of
 * what was billed; recalculating it in the browser would make it drift every
 * time another hour is tracked, which is the whole reason it is stored.
 *
 * `runApiData` rejects on failure rather than yielding undefined - treating a
 * failed request as an empty report would render a $0.00 invoice instead of an
 * error.
 */
export const invoiceQuery = createQuery({
  handler: (id: string) =>
    runApiData(() =>
      baseApi.invoiceControllerRead({ path: { id: id as never } }),
    ) as Promise<InvoiceRead>,
})

/**
 * Every invoice the caller can see: their own, plus all of them on projects
 * they own or view. Server-side access decides which - the client never
 * filters, so a bug here cannot widen visibility.
 */
/** One page of invoices. Matches the server's own default. */
export const INVOICE_PAGE_SIZE = 20

export type InvoiceListParams = {
  projectId?: string
  state?: 'PAID' | 'Requested'
  page: number
  /** Preserve the already-loaded prefix after a state change shifts offsets. */
  reloadThroughPage?: number
}

export const invoiceListQuery = createQuery({
  handler: async ({
    projectId,
    state,
    page,
    reloadThroughPage,
  }: InvoiceListParams): Promise<{
    items: baseApi.InvoiceSearch[]
    total: number
    page: number
  }> => {
    const fetchPage = async (page: number) => {
      const [items, total] = (await runApiData(() =>
        baseApi.invoiceControllerSearch({
          body: {
            filter: {
              ...(projectId ? { projectId } : {}),
              ...(state ? { state } : {}),
            },
            sort: { createdAt: 'DESC' },
            page,
            limit: INVOICE_PAGE_SIZE,
          },
        }),
      )) as [baseApi.InvoiceSearch[], number]
      return { items: items ?? [], total: Number(total ?? 0), page }
    }
    return reloadThroughPage === undefined
      ? fetchPage(page)
      : readLoadedInvoicePages(fetchPage, reloadThroughPage, INVOICE_PAGE_SIZE)
  },
})

/**
 * The projects offered in the invoice list's filter.
 *
 * Read from the projects endpoint rather than from the loaded invoices: once a
 * filter is applied the list holds one project, and options derived from it
 * would collapse to whatever is already selected.
 */
export const invoiceProjectsQuery = createQuery({
  handler: async (): Promise<baseApi.Project[]> => {
    const items = await collectSearchPages<baseApi.Project>(
      async (page, limit) =>
        (await runApiData(() =>
          baseApi.projectControllerSearch({
            body: { filter: {}, sort: { id: 'ASC' }, page, limit },
          }),
        )) as [baseApi.Project[], number],
    )

    return items.sort(
      (a, b) =>
        (a.title ?? '').localeCompare(b.title ?? '') ||
        (a.id ?? '').localeCompare(b.id ?? ''),
    )
  },
})

/** Every visible invoice for this project filter, collected before summing. */
export const invoiceSummaryQuery = createQuery({
  handler: async ({
    projectId,
  }: {
    projectId?: string
  }): Promise<baseApi.InvoiceSearch[]> =>
    collectSearchPages<baseApi.InvoiceSearch>(
      async (page, limit) =>
        (await runApiData(() =>
          baseApi.invoiceControllerSearch({
            body: {
              filter: projectId ? { projectId } : {},
              sort: { id: 'ASC' },
              page,
              limit,
            },
          }),
        )) as [baseApi.InvoiceSearch[], number],
    ),
})

// Filters describe independent results; late responses must not mix them.
concurrency(invoiceListQuery, { strategy: 'TAKE_LATEST' })
concurrency(invoiceProjectsQuery, { strategy: 'TAKE_LATEST' })
concurrency(invoiceSummaryQuery, { strategy: 'TAKE_LATEST' })
