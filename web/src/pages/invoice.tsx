import { ArrowLeftIcon } from '@radix-ui/react-icons'
import { Flex, Separator, Skeleton } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink, useParams } from 'react-router-dom'
import styled from 'styled-components'

import {
  fetchInvoice,
  $invoice,
  $invoiceLoading,
  resetInvoice,
  InvoiceCard,
  TotalAmountDesktop,
  TotalAmountMobile,
  Worklogs,
} from '@/features/invoice'
import { routes } from '@/routes'
import { Card, IconButton, PageHelmet, Text, useBreakpoint } from '@/shared'

export default function InvoicePage() {
  const { id } = useParams<{ id: string }>()

  const { fetchInvoiceEvent, invoice, loading, resetInvoiceEvent } = useUnit({
    fetchInvoiceEvent: fetchInvoice,
    invoice: $invoice,
    loading: $invoiceLoading,
    resetInvoiceEvent: resetInvoice,
  })

  const { t, i18n } = useTranslation()

  const isMobile = useBreakpoint('isMobile')

  useEffect(() => {
    if (id) {
      fetchInvoiceEvent({ id })
    }

    return () => {
      resetInvoiceEvent()
    }
  }, [id, fetchInvoiceEvent, resetInvoiceEvent])

  return (
    <>
      <PageHelmet
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
                  {invoice?.id}
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
