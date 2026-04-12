import { QuestionMarkCircledIcon } from '@radix-ui/react-icons'
import { Flex, Separator, Grid } from '@radix-ui/themes'
import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { getInvoiceInfoFields } from './invoice-info-fields.ts'
import { QrCodeImage } from './styled'

import { Text } from '@/features/shared'

export const TotalAmountMobile = () => {
  const { t } = useTranslation()
  const infoFields = getInvoiceInfoFields(t)

  return (
    <Flex gap={'3'} direction={'column'}>
      <Flex justify={'center'} align={'center'} direction={'column'} p={'4'}>
        <Text size={'4'} color={'gray'}>
          {t('invoice.totalAmount')}
        </Text>
        <Text size={'8'} weight={'medium'} $themeVariant={'primary'}>
          {t('invoice.amount.mobile')}
        </Text>
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

            <Text weight={'medium'}>{field.value}</Text>
          </Fragment>
        ))}
      </Grid>

      <Separator size={'4'} />

      <Flex justify={'center'}>
        <QrCodeImage src={'/img/photo/qr-code-example.svg'} />
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
