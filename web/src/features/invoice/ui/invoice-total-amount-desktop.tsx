import { Flex, Skeleton } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import {
  $invoice,
  $invoiceLoading,
  canMarkInvoiceByHand,
  getInvoiceInfoFields,
  type ProjectInvoice,
} from '../model'

import { InvoiceDescription } from './invoice-description'
import { InvoiceDocumentHeader } from './invoice-document-header'
import { InvoiceEscrowSettlement } from './invoice-escrow-settlement'
import { InvoicePaymentActions } from './invoice-payment-actions'
import { InvoiceReferenceCode } from './invoice-reference-code'
import { InvoiceStatusBadge } from './invoice-status-badge'

import { $user } from '@/entities/profile'
import { Button, Hint, Text, formatCurrency } from '@/shared'

export type InvoiceSheetProps = {
  invoice: ProjectInvoice | null
  loading: boolean
  /** Who is looking: only the invoice's issuer gets the payment control. */
  viewerId?: string | null
}

/**
 * The browser's print dialog is the export: it saves the page as a PDF on
 * every desktop and phone browser, with the print styles laying it out for
 * paper. There is no link to share - an invoice leaves the product as the
 * PDF its issuer sends (SPEC.md, "Who can see what").
 */
export const saveInvoicePdf = () => {
  window.print()
}

/**
 * The invoice page on a desktop, and the layout it prints in from one.
 *
 * Props rather than stores, so the same sheet is rendered by the page and by
 * the print-layout test with a complete invoice.
 */
export const InvoiceSheetDesktop = ({
  invoice,
  loading,
  viewerId,
}: InvoiceSheetProps) => {
  const { t } = useTranslation()

  const infoFields = getInvoiceInfoFields(invoice, t)

  const isPaid = invoice?.state === 'PAID'
  // Only the issuer may settle: the person owed the money is the one who
  // knows whether it arrived. Nobody may once it is submitted to escrow -
  // the chain's outcome settles it then.
  const canSettle = canMarkInvoiceByHand(invoice, viewerId)

  return (
    <Root>
      <InvoiceReferenceCode invoiceId={invoice?.id} loading={loading} />
      <Flex gap={'3'} direction={'column'} minWidth={'0'}>
        <Flex justify={'between'} align={'center'} gap={'4'} wrap={'wrap'}>
          <Flex align={'end'} gap={'3'} wrap={'wrap'} minWidth={'0'}>
            {loading ? (
              <Skeleton width="200px" height="18px" loading={loading} />
            ) : (
              <Title size={'6'} weight={'medium'}>
                {invoice?.title}
              </Title>
            )}
            <Text>{t('invoice.amount.for')}</Text>
            {loading ? (
              <Skeleton width="50px" height="18px" loading={loading} />
            ) : (
              <Text $themeVariant={'primary'} weight={'medium'} size={'4'}>
                {formatCurrency(invoice?.totalAmount)}
              </Text>
            )}
            {/* The state prints: a PDF that does not say whether it was paid
                is only half a record. */}
            {loading ? (
              <Skeleton width="60px" height="22px" loading={loading} />
            ) : (
              <InvoiceStatusBadge invoice={invoice} />
            )}
          </Flex>
          <InvoiceNoPrint gap={'3'} align={'center'}>
            {invoice?.id ? (
              <InvoicePaymentActions
                invoiceId={invoice.id}
                isPaid={isPaid}
                canSettle={canSettle}
                compact={false}
              />
            ) : null}
            <Button onClick={saveInvoicePdf}>
              {t('invoice.actions.savePdf')}
            </Button>
          </InvoiceNoPrint>
        </Flex>
        <InvoiceDocumentHeader invoice={invoice} loading={loading} />
        {loading ? null : (
          <InvoiceDescription description={invoice?.description} />
        )}
        {loading ? null : <InvoiceEscrowSettlement invoice={invoice} />}
        <Text size={'4'} weight={'medium'}>
          {t('invoice.summary.heading')}
        </Text>
        <Summary $rows={Math.ceil(infoFields.length / 2)}>
          {infoFields.map((field) => (
            <SummaryItem key={field.id} data-field={field.id}>
              <Flex align={'center'} gap={'1'} minWidth={'0'}>
                <Text size={'3'} color={'gray'}>
                  {t(`invoice.fields.${field.id}`)}
                </Text>
                {field.desc ? <Hint content={field.desc} /> : null}
              </Flex>
              {loading ? (
                <Skeleton />
              ) : (
                <Text size={'3'} weight={'medium'}>
                  {field.value}
                </Text>
              )}
            </SummaryItem>
          ))}
        </Summary>
      </Flex>
    </Root>
  )
}

/** The desktop sheet for the invoice the page has loaded. */
export const InvoiceTotalAmountDesktop = () => {
  const { invoice, loading, user } = useUnit({
    invoice: $invoice,
    loading: $invoiceLoading,
    user: $user,
  })

  return (
    <InvoiceSheetDesktop
      invoice={invoice}
      loading={loading}
      viewerId={user?.id}
    />
  )
}

const Root = styled.div`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: var(--space-5);

  @media print {
    gap: var(--space-4);
  }
`

const Title = styled(Text)`
  min-width: 0;
  overflow-wrap: anywhere;
`

/* Two columns filled top to bottom, as many rows as half the fields. */
const Summary = styled.div<{ $rows: number }>`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-auto-flow: column;
  grid-template-rows: repeat(${(p) => p.$rows}, auto);
  gap: var(--space-1) var(--space-8);

  @media print {
    gap: 2px var(--space-4);
  }
`

const SummaryItem = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 200px) max-content;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;

  @media print {
    grid-template-columns: minmax(0, 1fr) max-content;
  }
`

const InvoiceNoPrint = styled(Flex)`
  @media print {
    display: none;
  }
`
