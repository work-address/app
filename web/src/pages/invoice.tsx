import { ArrowLeftIcon } from '@radix-ui/react-icons'
import { Flex, Separator, Skeleton } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { useEffect } from 'react'
import { Helmet } from 'react-helmet-async'
import { useTranslation } from 'react-i18next'
import { NavLink, useParams } from 'react-router-dom'
import { useMediaQuery } from 'styled-breakpoints/use-media-query'
import styled, { useTheme } from 'styled-components'

import { fetchInvoice, $invoice, $invoiceLoading } from '@/entities/activities'
import {
  InvoiceCard,
  TotalAmountDesktop,
  TotalAmountMobile,
  Worklogs,
} from '@/features/invoice'
import { Card, IconButton, Text } from '@/features/shared'
import { routes } from '@/routes'

export default function InvoicePage() {
  const { id } = useParams<{ id: string }>()

  const { fetchInvoiceEvent, invoice, loading } = useUnit({
    fetchInvoiceEvent: fetchInvoice,
    invoice: $invoice,
    loading: $invoiceLoading,
  })

  const { t, i18n } = useTranslation()
  const { breakpoints } = useTheme()
  const isMobile = useMediaQuery(breakpoints.down('md'))

  useEffect(() => {
    if (id) {
      fetchInvoiceEvent({ id })
    }
  }, [id, fetchInvoiceEvent])

  return (
    <>
      <Helmet
        htmlAttributes={{ lang: i18n.language }}
        title={t('app.documentTitle.invoice')}
      />
      <CardWrapper shadow={false} as={isMobile ? 'div' : CardWrapper}>
        <Flex direction={'column'} gap={'20px'}>
          {isMobile && (
            <Flex gap={'2'} direction={'column'}>
              <Flex direction={'column'}>
                <IconWrapper to={routes.dashboard.build()}>
                  <IconButton variant={'ghost'} radius={'full'} color={'gray'}>
                    <ArrowLeftIcon />
                  </IconButton>
                </IconWrapper>

                {loading ? (
                  <Skeleton width="150px" height="24px" />
                ) : (
                  <Text>
                    <Skeleton loading={loading}>{invoice?.title}</Skeleton>
                  </Text>
                )}
              </Flex>

              {loading ? (
                <Skeleton width="200px" height="20px" />
              ) : (
                <Text color={'gray'} size={'2'}>
                  {invoice?.hash ?? invoice?.id}
                </Text>
              )}
            </Flex>
          )}

          {isMobile ? (
            <InvoiceCard shadow={false}>
              <TotalAmountMobile />
            </InvoiceCard>
          ) : (
            <TotalAmountDesktop />
          )}

          {!isMobile && (
            <>
              <Separator size={'4'} />
              <Separator size={'4'} />
            </>
          )}

          <Worklogs />
        </Flex>
      </CardWrapper>
    </>
  )
}

const IconWrapper = styled(NavLink)`
  padding-left: var(--space-2);
`

const CardWrapper = styled(Card)`
  padding: 20px var(--space-3);

  ${(p) => p.theme.breakpoints.up('md')} {
    width: 1196px;
    margin: var(--space-5) auto;
  }
`
