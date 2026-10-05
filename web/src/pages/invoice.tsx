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
import {
  Card,
  IconButton,
  PageHelmet,
  SectionTitle,
  Text,
  useBreakpoint,
  WidePageCard,
} from '@/shared'

export default function InvoicePage() {
  const { id } = useParams<{ id: string }>()

  const { fetchInvoiceEvent, invoice, loading, resetInvoiceEvent } = useUnit({
    fetchInvoiceEvent: fetchInvoice,
    invoice: $invoice,
    loading: $invoiceLoading,
    resetInvoiceEvent: resetInvoice,
  })

  const { t } = useTranslation()

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
      <PageHelmet title={t('app.documentTitle.invoice')} />
      <Root shadow={false} as={isMobile ? 'div' : undefined}>
        <Flex direction={'column'} gap={'20px'}>
          {/* The back arrow shares a row with the title rather than sitting
              alone above it, and the title is set like the other pages'. */}
          {isMobile && (
            <InvoiceNoPrint gap={'1'} direction={'column'}>
              <Flex align={'center'} gap={'2'}>
                <BackLink to={routes.dashboard.build()}>
                  <IconButton
                    variant={'ghost'}
                    radius={'full'}
                    color={'gray'}
                    aria-label={t('common.back')}
                  >
                    <ArrowLeftIcon />
                  </IconButton>
                </BackLink>
                {loading ? (
                  <Skeleton width="150px" height="24px" />
                ) : (
                  <Title>{invoice?.title}</Title>
                )}
              </Flex>
              {loading ? (
                <Skeleton width="200px" height="20px" />
              ) : (
                <Reference color={'gray'} size={'2'}>
                  {invoice?.id}
                </Reference>
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
      </Root>
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
      background: var(--white);
    }
  }
`

const Root = styled(WidePageCard)`
  /* The same inset as the pages that use Wrapper. */
  ${(p) => p.theme.breakpoints.down('md')} {
    padding: 18px 16px 24px;
  }

  @media print {
    width: 100%;
    max-width: none;
    margin: 0;
    padding: 0;
    box-shadow: none;
    border-radius: 0;
    background: var(--white);
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

const BackLink = styled(NavLink)`
  display: inline-flex;
  flex-shrink: 0;
`

const Title = styled(SectionTitle)`
  min-width: 0;
  overflow-wrap: anywhere;
`

/* An id has no break opportunities of its own; without this a long one
   pushes the page wider than the phone. */
const Reference = styled(Text)`
  overflow-wrap: anywhere;
`
