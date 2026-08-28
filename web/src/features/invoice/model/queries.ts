import { createQuery } from '@farfetched/core'

import type { ITimeTotal, ITimeTotalDetail } from '@/entities/time'

import { baseApi, runApiData } from '@/shared'

/**
 * The persisted invoice: the authoritative period, amount and state.
 *
 * The amount is read, never recomputed. A stored invoice is a frozen record of
 * what was billed; recalculating it in the browser would make it drift every
 * time another hour is tracked, which is the whole reason it is stored.
 */
export const invoiceQuery = createQuery({
  handler: (id: string) =>
    runApiData(() =>
      baseApi.invoiceControllerRead({ path: { id: id as never } }),
    ) as Promise<baseApi.InvoiceSearch>,
})

/**
 * These feed the time breakdown shown beneath the invoice total. Casting `.data` past a failure used to make a
 * failed request look like an empty report, which computed a $0.00 total
 * rather than showing an error - so failures have to reject here.
 */
export const activityDetailQuery = createQuery({
  handler: (id: string) =>
    runApiData(() =>
      baseApi.projectControllerRead({ path: { id: id as never } }),
    ) as Promise<baseApi.Project>,
})

export const activityReportQuery = createQuery({
  handler: (id: string) =>
    runApiData(() =>
      baseApi.timeControllerGetReport({ path: { id: id as never } }),
    ) as Promise<{ time: ITimeTotalDetail[]; totals: ITimeTotal[] }>,
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
