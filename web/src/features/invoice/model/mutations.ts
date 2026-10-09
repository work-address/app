import { createMutation } from '@farfetched/core'

import { readInvoiceSettlement } from './invoice-feed'

import { baseApi, runApiData } from '@/shared'

/**
 * Marking an invoice paid is what marks the hours behind it paid - the server
 * cascades it onto `Time.isPaid`, so the work record and the money record
 * cannot disagree. Only the issuer may do it: the person owed the money is the
 * one who knows whether it arrived.
 */
export const markInvoicePaidMutation = createMutation({
  handler: async (id: string) => {
    const invoice = await runApiData(() =>
      baseApi.invoiceControllerMarkPaid({ path: { id: id as never } }),
    )
    return readInvoiceSettlement(id, invoice as baseApi.InvoiceSearch)
  },
})

/** Reverts a mistaken mark, releasing the hours back to unpaid. */
export const markInvoiceUnpaidMutation = createMutation({
  handler: async (id: string) => {
    const invoice = await runApiData(() =>
      baseApi.invoiceControllerMarkUnpaid({ path: { id: id as never } }),
    )
    return readInvoiceSettlement(id, invoice as baseApi.InvoiceSearch)
  },
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
