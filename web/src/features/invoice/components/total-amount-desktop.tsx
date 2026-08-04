import { Flex, Grid, Skeleton } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { QRCodeSVG } from 'qrcode.react'
import { Trans, useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { useInvoiceInfoFields } from '../hooks'
import { $invoice, $invoiceLoading } from '../model'

import { Text, Button, copyToClipboard, showToast } from '@/shared'

const handleSavePdf = () => {
  window.print()
}

export const TotalAmountDesktop = () => {
  const { t } = useTranslation()

  const infoFields = useInvoiceInfoFields()

  const { invoice, loading } = useUnit({
    invoice: $invoice,
    loading: $invoiceLoading,
  })

  const handleShare = () => {
    copyToClipboard(window.location.href)
      .then(() => {
        showToast('info', {
          message: t('invoice.actions.linkCopied'),
          position: 'top-center',
        })
      })
      .catch(() => {
        showToast('error', {
          message: t('invoice.actions.linkCopyFailed'),
          position: 'top-center',
        })
      })
  }

  return (
    <Grid gap={'5'} columns={'auto 1fr'}>
      <Flex direction={'column'} align={'center'}>
        {loading ? (
          <Skeleton width="194px" height="194px" loading={loading} />
        ) : (
          <QRCodeSVG
            value={invoice?.id || ''}
            size={194}
            bgColor="transparent"
            fgColor="var(--ds-accent-9)"
            marginSize={1}
          />
        )}
        <Text color={'gray'} align={'center'}>
          <Trans i18nKey="invoice.qrScan.desktop" components={{ br: <br /> }} />
        </Text>
      </Flex>
      <Flex gap={'3'} direction={'column'}>
        <Flex justify={'between'} align={'center'} gap={'4'}>
          <Flex align={'end'} gap={'3'} wrap={'wrap'}>
            {loading ? (
              <Skeleton width="200px" height="18px" loading={loading} />
            ) : (
              <Text size={'6'} weight={'medium'}>
                {invoice?.title}
              </Text>
            )}
            <Text>{t('invoice.amount.for')}</Text>
            {loading ? (
              <Skeleton width="50px" height="18px" loading={loading} />
            ) : (
              <Text $themeVariant={'primary'} weight={'medium'} size={'4'}>
                {invoice?.totalAmount} {t('currency.usdt')}
              </Text>
            )}
          </Flex>
          <InvoiceNoPrint gap={'3'}>
            <Button color="neutral" variant="soft" onClick={handleShare}>
              {t('invoice.actions.share')}
            </Button>
            <Button onClick={handleSavePdf}>
              {t('invoice.actions.savePdf')}
            </Button>
          </InvoiceNoPrint>
        </Flex>
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
              columns={'200px max-content'}
              align="center"
            >
              <Text size={'3'} color={'gray'}>
                {t(`invoice.fields.${field.id}`)}
              </Text>
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

const InvoiceNoPrint = styled(Flex)`
  @media print {
    display: none;
  }
`
