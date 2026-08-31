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
export const invoiceListQuery = createQuery({
  handler: async (): Promise<baseApi.InvoiceSearch[]> => {
    // `runApiData` rejects on failure. Reading `.data?.[0] ?? []` instead would
    // turn a 500 or a dropped session into an empty list, so the page would say
    // "no invoices yet" when the truth is that it could not ask - the same trap
    // the activity queries above already call out.
    const [items] = (await runApiData(() =>
      baseApi.invoiceControllerSearch({
        body: { filter: {}, sort: { createdAt: 'DESC' }, page: 0 },
      }),
    )) as [baseApi.InvoiceSearch[], number]

    return items ?? []
  },
})
