import { createMutation } from '@farfetched/core'
import { AxiosError } from 'axios'

import { readInvoiceSettlement } from './invoice-feed'

import { baseApi, runApiData } from '@/shared'

/**
 * One settlement request. The answer is checked inside the call, so an invoice
 * the server sends back wrong is reported the same way as a refusal.
 */
const settle = (id: string, call: () => Promise<unknown>) =>
  runApiData(
    async () => {
      const response = await call()

      return response instanceof AxiosError
        ? response
        : {
            data: readInvoiceSettlement(
              id,
              (response as { data: baseApi.InvoiceSearch }).data,
            ),
          }
    },
    { fixed: 'invoice.payment.failed' },
  )

/**
 * Marking an invoice paid marks the hours behind it paid - the server cascades
 * it onto `Time.isPaid`, over any hand-mark. Only the issuer may do it: the
 * person owed the money is the one who knows whether it arrived.
 */
export const markInvoicePaidMutation = createMutation({
  handler: (id: string) =>
    settle(id, () =>
      baseApi.invoiceControllerMarkPaid({ path: { id: id as never } }),
    ),
})

/** Reverts a mistaken mark, releasing the hours back to unpaid. */
export const markInvoiceUnpaidMutation = createMutation({
  handler: (id: string) =>
    settle(id, () =>
      baseApi.invoiceControllerMarkUnpaid({ path: { id: id as never } }),
    ),
})

/**
 * "Open the invoice for this project."
 *
 * Raises one for whatever the caller has not yet invoiced, or hands back their
 * latest if nothing is outstanding. Idempotent server-side: outstanding means
 * *unpaid and not already covered by one of their invoices*, so clicking twice
 * cannot bill the same hours twice. Existing invoices are never rewritten -
 * each stays the frozen record of its own period.
 */
export const ensureInvoiceMutation = createMutation({
  handler: async (projectId: string) =>
    runApiData(() =>
      baseApi.invoiceControllerCreate({
        path: { projectId: projectId as never },
        // No range means "everything outstanding". The same route bills an
        // explicit period when one is given, so there is one place that
        // decides who may invoice a project.
        body: {},
      }),
    ) as Promise<baseApi.InvoiceSearch | null>,
})

// Kept public here for existing invoice consumers and success routing.
export { invoiceSelectedTimeMutation } from '@/entities/invoice'
