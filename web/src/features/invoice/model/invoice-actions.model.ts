import { combine, createEvent, sample } from 'effector'

import { getInvoicePageUrl } from './invoice-actions'
import { saveInvoicePdfFx, shareInvoiceFx } from './invoice-actions.effects'
import { $invoiceSettlementPendingIds } from './settlement.model'
import { $invoice, $invoiceLoading } from './stores'

import { $user } from '@/entities/profile'
import { showToastFx, translate } from '@/shared'

export const shareInvoiceRequested = createEvent()
export const saveInvoicePdfRequested = createEvent()

export const $invoiceCanSettle = combine($invoice, $user, (invoice, user) =>
  Boolean(user?.id && invoice?.user?.id === user.id),
)
export const $invoiceSharePending = shareInvoiceFx.pending
export const $invoicePrintPending = saveInvoicePdfFx.pending
export const $invoiceActionsPending = combine(
  $invoice,
  $invoiceLoading,
  $invoiceSettlementPendingIds,
  $invoiceSharePending,
  $invoicePrintPending,
  (invoice, loading, settlingIds, sharing, printing) =>
    loading ||
    Boolean(invoice?.id && settlingIds[invoice.id]) ||
    sharing ||
    printing,
)

sample({
  clock: shareInvoiceRequested,
  source: { invoice: $invoice, pending: $invoiceActionsPending },
  filter: ({ invoice, pending }) => Boolean(invoice?.id) && !pending,
  fn: ({ invoice }) => ({
    url: getInvoicePageUrl(window.location.origin, invoice!.id!),
    title: invoice?.title
      ? translate('invoice.page.documentTitle', { project: invoice.title })
      : translate('app.documentTitle.invoice'),
  }),
  target: shareInvoiceFx,
})

sample({
  clock: saveInvoicePdfRequested,
  source: { invoice: $invoice, pending: $invoiceActionsPending },
  filter: ({ invoice, pending }) => Boolean(invoice?.id) && !pending,
  fn: () => {},
  target: saveInvoicePdfFx,
})

sample({
  clock: shareInvoiceFx.doneData,
  filter: (result) => result === 'copied',
  fn: () => ({
    type: 'info' as const,
    messageKey: 'invoice.actions.linkCopied',
  }),
  target: showToastFx,
})

sample({
  clock: shareInvoiceFx.fail,
  fn: () => ({
    type: 'error' as const,
    messageKey: 'invoice.actions.linkCopyFailed',
  }),
  target: showToastFx,
})

sample({
  clock: saveInvoicePdfFx.fail,
  fn: () => ({
    type: 'error' as const,
    messageKey: 'invoice.actions.pdfFailed',
  }),
  target: showToastFx,
})
