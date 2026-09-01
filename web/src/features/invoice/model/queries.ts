import { createQuery } from '@farfetched/core'

import type { InvoiceRead } from './types'

import { baseApi, runApiData } from '@/shared'

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
  page: number
}

export const invoiceListQuery = createQuery({
  handler: async ({
    projectId,
    page,
  }: InvoiceListParams): Promise<{
    items: baseApi.InvoiceSearch[]
    total: number
  }> => {
    // `runApiData` rejects on failure. Reading `.data?.[0] ?? []` instead would
    // turn a 500 or a dropped session into an empty list, so the page would say
    // "no invoices yet" when the truth is that it could not ask - the same trap
    // the activity queries above already call out.
    const [items, total] = (await runApiData(() =>
      baseApi.invoiceControllerSearch({
        body: {
          // Filtered server-side rather than in the browser: the search
          // returns one page, so filtering what happened to arrive would hide
          // invoices that simply fell past the page boundary.
          filter: projectId ? { projectId } : {},
          sort: { createdAt: 'DESC' },
          page,
          limit: INVOICE_PAGE_SIZE,
        },
      }),
    )) as [baseApi.InvoiceSearch[], number]

    // The count is what tells the list whether another page exists; without it
    // "load more" could only guess from a full page and would offer one more
    // click on an exact multiple of the page size.
    return { items: items ?? [], total: Number(total ?? 0) }
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
    const [items] = (await runApiData(() =>
      baseApi.projectControllerSearch({
        body: { filter: {}, sort: { title: 'ASC' }, page: 0, limit: 100 },
      }),
    )) as [baseApi.Project[], number]

    return items ?? []
  },
})
