import { Flex, Separator, Skeleton } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import {
  $invoice,
  $invoiceLoading,
  canMarkInvoiceByHand,
  getInvoiceInfoFields,
} from '../model'

import { InvoiceDescription } from './invoice-description'
import { InvoiceDocumentHeader } from './invoice-document-header'
import { InvoiceEscrowSettlement } from './invoice-escrow-settlement'
import { InvoicePaymentActions } from './invoice-payment-actions'
import { InvoiceReferenceCode } from './invoice-reference-code'
import { InvoiceStatusBadge } from './invoice-status-badge'
import {
  saveInvoicePdf,
  type InvoiceSheetProps,
} from './invoice-total-amount-desktop'

import { $user } from '@/entities/profile'
import { Button, formatCurrency, Hint, Text } from '@/shared'

/**
 * The invoice page on a phone, and the layout it prints in from one.
 *
 * Save PDF is here too: a phone's print dialog saves a PDF (or hands it to
 * the share sheet) like a desktop's does, and without the button a phone
 * had no way to get the invoice out at all.
 */
export const InvoiceSheetMobile = ({
  invoice,
  loading,
  viewerId,
}: InvoiceSheetProps) => {
  const { t } = useTranslation()

  const infoFields = getInvoiceInfoFields(invoice, t)

  const isPaid = invoice?.state === 'PAID'
  // The issuer's control, gone once the invoice is submitted to escrow.
  const canSettle = canMarkInvoiceByHand(invoice, viewerId)

  return (
    <Flex gap={'3'} direction={'column'} minWidth={'0'}>
      <Flex
        justify={'center'}
        align={'center'}
        direction={'column'}
        gap={'2'}
        p={'4'}
      >
        <Text size={'4'} color={'gray'}>
          {t('invoice.totalAmount')}
        </Text>
        {loading ? (
          <Skeleton height="40px" width="80px" />
        ) : (
          <Text size={'8'} weight={'medium'} $themeVariant={'primary'}>
            {formatCurrency(invoice?.totalAmount)}
          </Text>
        )}
        {loading ? (
          <Skeleton height="22px" width="90px" />
        ) : (
          <InvoiceStatusBadge invoice={invoice} />
        )}
      </Flex>
      <NoPrint direction={'column'} gap={'2'}>
        {invoice?.id && canSettle ? (
          <InvoicePaymentActions
            invoiceId={invoice.id}
            isPaid={isPaid}
            canSettle={canSettle}
            compact={false}
            stretch
          />
        ) : null}
        <Button
          variant={canSettle ? 'soft' : 'solid'}
          color={canSettle ? 'neutral' : undefined}
          stretch
          disabled={loading}
          onClick={saveInvoicePdf}
        >
          {t('invoice.actions.savePdf')}
        </Button>
      </NoPrint>
      <InvoiceDocumentHeader invoice={invoice} loading={loading} />
      {loading ? null : (
        <InvoiceDescription description={invoice?.description} />
      )}
      {loading ? null : <InvoiceEscrowSettlement invoice={invoice} />}
      <Separator size={'4'} />
      <Summary>
        {infoFields.map((field) => (
          <Fragment key={field.id}>
            <Flex align={'center'} gap={'1'} minWidth={'0'}>
              <Text size={'3'} color={'gray'}>
                {t(`invoice.fields.${field.id}`)}
              </Text>
              {field.desc ? <Hint content={field.desc} size={16} /> : null}
            </Flex>
            {loading ? (
              <Skeleton height="20px" width="100%" />
            ) : (
              <Text weight={'medium'} data-field={field.id}>
                {field.value}
              </Text>
            )}
          </Fragment>
        ))}
      </Summary>
      <Separator size={'4'} />
      <InvoiceReferenceCode invoiceId={invoice?.id} loading={loading} />
    </Flex>
  )
}

/** The mobile sheet for the invoice the page has loaded. */
export const InvoiceTotalAmountMobile = () => {
  const { invoice, loading, user } = useUnit({
    invoice: $invoice,
    loading: $invoiceLoading,
    user: $user,
  })

  return (
    <InvoiceSheetMobile
      invoice={invoice}
      loading={loading}
      viewerId={user?.id}
    />
  )
}

const Summary = styled.div`
  display: grid;
  grid-template-columns: 137px minmax(0, 1fr);
  align-items: end;
  gap: var(--space-4);
  padding: var(--space-2) 0;
`

const NoPrint = styled(Flex)`
  @media print {
    display: none;
  }
`
