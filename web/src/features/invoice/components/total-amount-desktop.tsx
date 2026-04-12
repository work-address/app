import { Flex, Grid, Separator } from '@radix-ui/themes'
import { Trans, useTranslation } from 'react-i18next'

import { getInvoiceInfoFields } from './invoice-info-fields.ts'
import { QrCodeImage } from './styled'

import { Text, Button } from '@/features/shared'

export const TotalAmountDesktop = () => {
  const { t } = useTranslation()
  const infoFields = getInvoiceInfoFields(t)

  return (
    <Grid gap={'5'} justify={'between'} columns={'auto 1fr auto'}>
      <Flex direction={'column'} gap={'3'} align={'center'}>
        <QrCodeImage src={'/img/photo/qr-code-example.svg'} />

        <Text color={'gray'} align={'center'}>
          <Trans i18nKey="invoice.qrScan.desktop" components={{ br: <br /> }} />
        </Text>
      </Flex>

      <Flex gap={'3'} direction={'column'} justify={'between'}>
        <Flex align={'end'} gap={'3'}>
          <Text size={'6'} weight={'medium'}>
            {t('invoice.mock.projectName')}
          </Text>

          <Text>{t('invoice.amount.for')}</Text>

          <Text $themeVariant={'primary'} weight={'medium'} size={'4'}>
            {t('invoice.amount.desktop')}
          </Text>
        </Flex>

        <Text color={'gray'}>{t('invoice.mock.hash')}</Text>

        <Separator size={'4'} />

        <Text size={'4'} weight={'medium'}>
          {t('invoice.summary.heading')}
        </Text>

        <Grid columns={'1fr 1fr'} gap={'5'} flow={'column'} rows={'3'}>
          {infoFields.map((field) => (
            <Grid key={field.id} gap={'2'} columns={'120px 204px'}>
              <Text size={'3'} color={'gray'}>
                {t(`invoice.fields.${field.id}`)}
              </Text>
              <Text size={'3'} weight={'medium'}>
                {field.value}
              </Text>
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
