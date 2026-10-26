import { Badge, Flex, Grid, Separator, Skeleton } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { QRCodeSVG } from 'qrcode.react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import {
  invoiceStateColor,
  invoiceStateLabelKey,
  useInvoiceInfoFields,
} from '../lib'
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
              <Badge size="2" variant="soft" color={invoiceStateColor(invoice)}>
                {t(invoiceStateLabelKey(invoice))}
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
        <Separator size={'4'} />
        {/* The facts need no heading: under the title and the reference they
            are self-evidently the invoice's summary. */}
        <Facts>
          {infoFields.map((field) => (
            <Fact key={field.id}>
              <Label>
                <Text size={'3'} color={'gray'}>
                  {t(`invoice.fields.${field.id}`)}
                </Text>
                {field.desc ? <Hint content={field.desc} /> : null}
              </Label>
              {loading ? (
                <Skeleton />
              ) : (
                <Text size={'3'} weight={'medium'}>
                  {field.value}
                </Text>
              )}
            </Fact>
          ))}
        </Facts>
      </Flex>
    </Grid>
  )
}

const Reference = styled(Text)`
  overflow-wrap: anywhere;
`

/* Two columns of label-value pairs, filled down the first column first, so
   the time figures read top to bottom and the input counts beside them. */
const Facts = styled.dl`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-auto-flow: column;
  grid-template-rows: repeat(5, auto);
  column-gap: var(--space-8);
  row-gap: var(--space-1);
  margin: 0;
`

/* The label keeps to one line whatever it says, so its value and the hint
   beside it stay on that same line - the rows then line up across columns. */
const Fact = styled.div`
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  align-items: center;
  gap: var(--space-3);
  min-height: 32px;
`

const Label = styled.dt`
  display: grid;
  grid-auto-flow: column;
  align-items: center;
  justify-content: start;
  gap: var(--space-1);
  white-space: nowrap;
`
