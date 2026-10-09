import { useUnit } from 'effector-react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import {
  $invoice,
  $invoiceActionsPending,
  $invoiceCanSettle,
  $invoicePrintPending,
  $invoiceSharePending,
  saveInvoicePdfRequested,
  shareInvoiceRequested,
  type InvoiceActionsLayout,
} from '../model'

import { InvoicePaymentActions } from './invoice-payment-actions'

import { Button } from '@/shared'

type Props = { layout?: InvoiceActionsLayout; className?: string }

/** The same invoice capabilities, arranged for the available width. */
export const InvoiceActions = ({ layout = 'desktop', className }: Props) => {
  const { t } = useTranslation()
  const { invoice, pending, canSettle, sharing, printing, share, savePdf } =
    useUnit({
      invoice: $invoice,
      pending: $invoiceActionsPending,
      canSettle: $invoiceCanSettle,
      sharing: $invoiceSharePending,
      printing: $invoicePrintPending,
      share: shareInvoiceRequested,
      savePdf: saveInvoicePdfRequested,
    })
  const isPaid = invoice?.state === 'PAID'
  const disabled = pending || !invoice?.id

  return (
    <Root
      data-layout={layout}
      aria-busy={pending || undefined}
      className={className}
    >
      {invoice?.id && canSettle ? (
        <Settlement>
          <InvoicePaymentActions
            invoiceId={invoice.id}
            isPaid={isPaid}
            canSettle={canSettle}
            compact={false}
            stretch={layout === 'mobile'}
            disabled={disabled}
            variant={isPaid ? 'outline' : 'solid'}
          />
        </Settlement>
      ) : null}
      <Button
        variant={canSettle && !isPaid ? 'soft' : 'solid'}
        color={canSettle && !isPaid ? 'neutral' : 'primary'}
        disabled={disabled}
        loading={sharing}
        stretch={layout === 'mobile'}
        onClick={share}
      >
        {t('invoice.actions.share')}
      </Button>
      <Button
        variant="outline"
        color="neutral"
        disabled={disabled}
        loading={printing}
        stretch={layout === 'mobile'}
        onClick={savePdf}
      >
        {t('invoice.actions.savePdf')}
      </Button>
    </Root>
  )
}

const Root = styled.div`
  display: grid;
  grid-auto-flow: column;
  align-items: center;
  gap: var(--space-3);

  &[data-layout='mobile'] {
    grid-auto-flow: row;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-2);
  }

  @media print {
    display: none;
  }
`

const Settlement = styled.div`
  ${Root}[data-layout='mobile'] & {
    grid-column: 1 / -1;
  }
`
