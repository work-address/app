import { Flex, Separator, Grid, Skeleton } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { QRCodeSVG } from 'qrcode.react'
import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'

import { useInvoiceInfoFields } from '../lib'
import { $invoice, $invoiceLoading, canMarkInvoiceByHand } from '../model'

import { InvoiceDescription } from './invoice-description'
import { InvoiceEscrowSettlement } from './invoice-escrow-settlement'
import { InvoicePaymentActions } from './invoice-payment-actions'
import { InvoiceStatusBadge } from './invoice-status-badge'

import { $user } from '@/entities/profile'
import { BASE_CURRENCY, formatCurrency, Hint, Text } from '@/shared'

export const InvoiceTotalAmountMobile = () => {
  const { t } = useTranslation()

  const infoFields = useInvoiceInfoFields()

  const { invoice, loading, user } = useUnit({
    invoice: $invoice,
    loading: $invoiceLoading,
    user: $user,
  })

  const isPaid = invoice?.state === 'PAID'
  // The issuer's control, gone once the invoice is submitted to escrow.
  const canSettle = canMarkInvoiceByHand(invoice, user?.id)

  return (
    <Flex gap={'3'} direction={'column'}>
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
      {invoice?.id && canSettle ? (
        <InvoicePaymentActions
          invoiceId={invoice.id}
          isPaid={isPaid}
          canSettle={canSettle}
          compact={false}
          stretch
        />
      ) : null}
      {loading ? null : (
        <InvoiceDescription description={invoice?.description} />
      )}
      {loading ? null : <InvoiceEscrowSettlement invoice={invoice} />}
      <Separator size={'4'} />
      <Grid
        columns={{ initial: '137px 1fr' }}
        gap={{ initial: '4' }}
        align={'end'}
        py={'2'}
      >
        {infoFields.map((field) => (
          <Fragment key={field.id}>
            <Flex align={'center'} gap={'1'}>
              <Text size={'3'} color={'gray'}>
                {t(`invoice.fields.${field.id}`)}
              </Text>
              {field.desc ? <Hint content={field.desc} size={16} /> : null}
            </Flex>
            {loading ? (
              <Skeleton height="20px" width="100%" />
            ) : (
              <Text weight={'medium'}>{field.value}</Text>
            )}
          </Fragment>
        ))}
      </Grid>
      <Separator size={'4'} />
      <Flex justify={'center'}>
        {loading ? (
          <Skeleton height="194px" width="194px" />
        ) : (
          <QRCodeSVG
            value={invoice?.id || ''}
            size={194}
            bgColor="transparent"
            fgColor="var(--ds-accent-9)"
            marginSize={1}
          />
        )}
      </Flex>
      <Text color={'gray'} weight={'regular'} align={'center'}>
        {t('invoice.qrScan.mobile', { currency: BASE_CURRENCY.code })}
      </Text>
    </Flex>
  )
}
