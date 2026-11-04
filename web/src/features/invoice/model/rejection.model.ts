import { createMutation } from '@farfetched/core'
import { combine, createEvent, sample } from 'effector'

import {
  $invoicePage,
  $invoiceProjectFilter,
  $invoiceSort,
  $invoiceStateFilter,
  $invoices,
} from './list.stores'
import { invoiceListQuery, invoiceQuery, invoiceSummaryQuery } from './queries'
import { $invoice } from './stores'

import { $user } from '@/entities/profile'
import { baseApi, runApiData } from '@/shared'

export const invoiceRejectionRequested = createEvent<string>()
export const $invoiceCanReject = combine($invoice, $user, (invoice, user) =>
  Boolean(
    user?.id &&
      invoice?.project?.user?.id === user.id &&
      invoice.state === 'Requested',
  ),
)
export const rejectInvoiceMutation = createMutation({
  handler: ({ id, reason }: { id: string; reason: string }) =>
    runApiData(() =>
      baseApi.invoiceControllerReject({
        path: { id: id as never },
        body: { reason },
      }),
    ),
})
sample({
  clock: invoiceRejectionRequested,
  source: {
    invoice: $invoice,
    allowed: $invoiceCanReject,
    pending: rejectInvoiceMutation.$pending,
  },
  filter: ({ invoice, allowed, pending }) =>
    Boolean(invoice?.id) && allowed && !pending,
  fn: ({ invoice }, reason) => ({ id: invoice!.id!, reason }),
  target: rejectInvoiceMutation.start,
})
// The page re-reads the record it shows. A read already in flight is
// superseded by this one, never allowed to leave the reject form on screen.
sample({
  clock: rejectInvoiceMutation.finished.success,
  source: invoiceQuery.$data,
  filter: (current, { params }) => current?.id === params.id,
  fn: (_, { params }) => params.id,
  target: invoiceQuery.start,
})
// A loaded list rebuilds every page it holds, as settlement does, so the row
// leaves the Awaiting tab; the owed totals are re-read either way.
sample({
  clock: rejectInvoiceMutation.finished.success,
  source: {
    items: $invoices,
    projectId: $invoiceProjectFilter,
    state: $invoiceStateFilter,
    sort: $invoiceSort,
    page: $invoicePage,
  },
  filter: ({ items }) => items.length > 0,
  fn: ({ projectId, state, sort, page }) => ({
    projectId: projectId || undefined,
    state: state || undefined,
    sort,
    page: 0,
    reloadThroughPage: page,
  }),
  target: invoiceListQuery.start,
})
sample({
  clock: rejectInvoiceMutation.finished.success,
  source: $invoiceProjectFilter,
  fn: (projectId) => ({ projectId: projectId || undefined }),
  target: invoiceSummaryQuery.start,
})
