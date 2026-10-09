import { Badge, Flex, Separator, Grid, Skeleton } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { QRCodeSVG } from 'qrcode.react'
import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'

import { useInvoiceInfoFields } from '../lib'
import { $invoice, $invoiceLoading, getInvoicePageUrl } from '../model'

import { InvoiceActions } from './invoice-actions'

import { formatCurrency, Hint, Text } from '@/shared'

export const InvoiceTotalAmountMobile = () => {
  const { t } = useTranslation()

  const infoFields = useInvoiceInfoFields()

  const { invoice, loading } = useUnit({
    invoice: $invoice,
    loading: $invoiceLoading,
  })

  const isPaid = invoice?.state === 'PAID'
  const invoiceUrl = invoice?.id
    ? getInvoicePageUrl(window.location.origin, invoice.id)
    : ''

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
          <Badge size="2" variant="soft" color={isPaid ? 'green' : 'amber'}>
            {t(isPaid ? 'invoice.state.paid' : 'invoice.state.requested')}
          </Badge>
        )}
      </Flex>
      <InvoiceActions layout="mobile" />
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
            value={invoiceUrl}
            size={194}
            bgColor="transparent"
            fgColor="var(--ds-accent-9)"
            marginSize={1}
          />
        )}
      </Flex>
      <Text color={'gray'} weight={'regular'} align={'center'}>
        {t('invoice.qrScan.mobile')}
      </Text>
    </Flex>
  )
}
