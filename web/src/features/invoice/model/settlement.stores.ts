import { createStore } from 'effector'

import { markInvoicePaidMutation, markInvoiceUnpaidMutation } from './mutations'

/** Both directions guard the same invoice; other invoices remain available. */
export const $invoiceSettlementPendingIds = createStore<
  Record<string, boolean>
>({})
  .on(
    [markInvoicePaidMutation.start, markInvoiceUnpaidMutation.start],
    (pending, id) => ({ ...pending, [id]: true }),
  )
  .on(
    [
      markInvoicePaidMutation.finished.finally,
      markInvoiceUnpaidMutation.finished.finally,
    ],
    (pending, { params }) => {
      const next = { ...pending }
      delete next[params]
      return next
    },
  )
