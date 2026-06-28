import { QuestionMarkCircledIcon } from '@radix-ui/react-icons'
import { Flex, Separator, Grid, Skeleton } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { QRCodeSVG } from 'qrcode.react'
import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { useInvoiceInfoFields } from '../hooks'
import { $invoice, $invoiceLoading } from '../model'

import { Text } from '@/shared'

export const TotalAmountMobile = () => {
  const { t } = useTranslation()

  const infoFields = useInvoiceInfoFields()

  const { invoice, loading } = useUnit({
    invoice: $invoice,
    loading: $invoiceLoading,
  })

  return (
    <Flex gap={'3'} direction={'column'}>
      <Flex justify={'center'} align={'center'} direction={'column'} p={'4'}>
        <Text size={'4'} color={'gray'}>
          {t('invoice.totalAmount')}
        </Text>
        {loading ? (
          <Skeleton height="40px" width="80px" />
        ) : (
          <Text size={'8'} weight={'medium'} $themeVariant={'primary'}>
            {invoice?.totalAmount} {t('currency.usdt')}
          </Text>
        )}
      </Flex>
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
              {field.hasDesc === true ? (
                <StyledQuestionMarkCircledIcon
                  aria-label={t(`invoice.fieldDesc.${field.id}`)}
                />
              ) : null}
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
        {t('invoice.qrScan.mobile')}
      </Text>
    </Flex>
  )
}

const StyledQuestionMarkCircledIcon = styled(QuestionMarkCircledIcon)`
  height: 16px;
  width: 16px;
`
