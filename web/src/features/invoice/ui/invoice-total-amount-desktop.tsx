import { Badge, Flex, Grid, Skeleton } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { QRCodeSVG } from 'qrcode.react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { useInvoiceInfoFields } from '../lib'
import { $invoice, $invoiceLoading, getInvoicePageUrl } from '../model'

import { InvoiceActions } from './invoice-actions'

import { Text, formatCurrency, Hint, PageTitle } from '@/shared'

export const InvoiceTotalAmountDesktop = () => {
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
    <Grid gap={'5'} columns={'auto 1fr'}>
      <Flex direction={'column'} align={'center'}>
        {loading ? (
          <Skeleton width="194px" height="194px" loading={loading} />
        ) : (
          <QRCodeSVG
            value={invoiceUrl}
            size={194}
            bgColor="transparent"
            fgColor="var(--ds-accent-9)"
            marginSize={1}
          />
        )}
        <Text color={'gray'} align={'center'}>
          {t('invoice.qrScan.desktop')}
        </Text>
      </Flex>
      <Flex gap={'3'} direction={'column'}>
        <Flex justify={'between'} align={'center'} gap={'4'}>
          <Flex align={'baseline'} gap={'3'} wrap={'wrap'}>
            {loading ? (
              <Skeleton width="200px" height="35px" loading={loading} />
            ) : (
              <PageTitle>{invoice?.title}</PageTitle>
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
              <Badge size="2" variant="soft" color={isPaid ? 'green' : 'amber'}>
                {t(isPaid ? 'invoice.state.paid' : 'invoice.state.requested')}
              </Badge>
            )}
          </Flex>
          <InvoiceActions />
        </Flex>
        {loading ? (
          <Skeleton width="290px" height="18px" />
        ) : (
          <Reference color="gray" size="2">
            {t('invoices.item.reference')} {invoice?.id}
          </Reference>
        )}
        <Text size={'4'} weight={'medium'}>
          {t('invoice.summary.heading')}
        </Text>
        <Grid
          columns={'1fr 1fr'}
          flow={'column'}
          rows={'5'}
          gapY={'1'}
          gapX={'8'}
        >
          {infoFields.map((field) => (
            <Grid
              key={field.id}
              gap={'2'}
              columns={'160px max-content'}
              align="center"
            >
              <Flex align={'center'} gap={'1'}>
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
            </Grid>
          ))}
        </Grid>
      </Flex>
    </Grid>
  )
}

const Reference = styled(Text)`
  overflow-wrap: anywhere;
`
