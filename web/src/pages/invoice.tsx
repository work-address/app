import { ArrowLeftIcon } from '@radix-ui/react-icons'
import { Flex, Skeleton } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink, useParams } from 'react-router-dom'
import styled, { createGlobalStyle } from 'styled-components'

import {
  fetchInvoice,
  $invoice,
  $invoiceLoading,
  resetInvoice,
  InvoiceTotalAmountDesktop,
  InvoiceTotalAmountMobile,
  InvoiceTime,
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
      <InvoicePrintGlobalStyle />
      <PageHelmet
        htmlAttributes={{ lang: i18n.language }}
        title={t('app.documentTitle.invoice')}
      />
      <InvoicePageCard shadow={false} as={isMobile ? 'div' : undefined}>
        <Flex direction={'column'} gap={'20px'}>
          {isMobile && (
            <InvoiceNoPrint gap={'4'} direction={'column'}>
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
            </InvoiceNoPrint>
          )}
          {isMobile ? (
            <InvoiceCard shadow={false}>
              <InvoiceTotalAmountMobile />
            </InvoiceCard>
          ) : (
            <InvoiceTotalAmountDesktop />
          )}
          <InvoiceTime />
        </Flex>
      </InvoicePageCard>
    </>
  )
}

const InvoicePrintGlobalStyle = createGlobalStyle`
  @media print {
    @page {
      size: A4;
      margin: 12mm 12mm;
    }

    html,
    body,
    #root {
      height: auto;
      overflow: visible;
      background: #fff;
    }
  }
`

const InvoicePageCard = styled(Card)`
  padding: 20px var(--space-3);

  ${(p) => p.theme.breakpoints.up('md')} {
    width: 1196px;
    margin: var(--space-5) auto;
  }

  @media print {
    width: 100%;
    max-width: none;
    margin: 0;
    padding: 0;
    box-shadow: none;
    border-radius: 0;
    background: #fff;
  }
`

const InvoiceCard = styled(Card)`
  ${(p) => p.theme.breakpoints.down('md')} {
    padding: 12px;
  }
`

const InvoiceNoPrint = styled(Flex)`
  @media print {
    display: none;
  }
`

const IconWrapper = styled(NavLink)`
  padding-left: var(--space-2);
`
