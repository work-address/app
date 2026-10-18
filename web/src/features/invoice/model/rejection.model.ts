import { createMutation } from '@farfetched/core'
import { combine, createEvent, sample } from 'effector'

import { invoiceQuery } from './queries'
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
sample({
  clock: rejectInvoiceMutation.finished.success,
  source: { current: invoiceQuery.$data, loading: invoiceQuery.$pending },
  filter: ({ current, loading }, { params }) =>
    current?.id === params.id && !loading,
  fn: (_, { params }) => params.id,
  target: invoiceQuery.start,
})
