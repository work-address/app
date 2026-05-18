import { Flex, Grid, Separator, Skeleton } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { QRCodeSVG } from 'qrcode.react'
import { Trans, useTranslation } from 'react-i18next'

import { useInvoiceInfoFields } from '../hooks'
import { $invoice, $invoiceLoading } from '../model'

import { Text, Button } from '@/shared'

export const TotalAmountDesktop = () => {
  const { t } = useTranslation()

  const infoFields = useInvoiceInfoFields()

  const { invoice, loading } = useUnit({
    invoice: $invoice,
    loading: $invoiceLoading,
  })

  return (
    <Grid gap={'5'} justify={'between'} columns={'auto 1fr auto'}>
      <Flex direction={'column'} gap={'3'} align={'center'}>
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

      <Flex gap={'3'} direction={'column'} justify={'between'}>
        <Flex align={'end'} gap={'3'}>
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

        {loading ? (
          <Skeleton width="300px" height="18px" loading={loading} />
        ) : (
          <Text color={'gray'}>{invoice?.id}</Text>
        )}

        <Separator size={'4'} />

        <Text size={'4'} weight={'medium'}>
          {t('invoice.summary.heading')}
        </Text>

        <Grid columns={'1fr 1fr'} gap={'5'} flow={'column'} rows={'3'}>
          {infoFields.map((field) => (
            <Grid
              key={field.id}
              gap={'2'}
              columns={'120px 204px'}
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

      <Flex gap={'3'}>
        <Button themeVariant={'secondary'}>{t('invoice.actions.share')}</Button>
        <Button themeVariant={'primary'}>{t('invoice.actions.savePdf')}</Button>
      </Flex>
    </Grid>
  )
}
