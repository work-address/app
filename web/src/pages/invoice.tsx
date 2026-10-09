import { ArrowLeftIcon } from '@radix-ui/react-icons'
import { Skeleton } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import styled, { createGlobalStyle } from 'styled-components'

import {
  fetchInvoice,
  $invoice,
  $invoiceFailure,
  $invoiceLoading,
  buildInvoiceHead,
  resetInvoice,
  InvoiceTotalAmountDesktop,
  InvoiceTotalAmountMobile,
  InvoiceTime,
} from '@/features/invoice'
import { routes } from '@/routes'
import {
  Button,
  Card,
  formatCurrency,
  IconButton,
  isRecordId,
  LoadFailure,
  PageHelmet,
  PageTitle,
  StateNotice,
  Text,
  useBreakpoint,
  Wrapper,
} from '@/shared'

export default function InvoicePage() {
  const { id } = useParams<{ id: string }>()
  // A malformed id cannot name an invoice; say so without asking the API,
  // which answers one with a 500 rather than a 404.
  const validId = isRecordId(id)

  const { fetchInvoiceEvent, invoice, loading, failure, resetInvoiceEvent } =
    useUnit({
      fetchInvoiceEvent: fetchInvoice,
      invoice: $invoice,
      loading: $invoiceLoading,
      failure: $invoiceFailure,
      resetInvoiceEvent: resetInvoice,
    })

  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()

  const isMobile = useBreakpoint('isMobile')

  useEffect(() => {
    if (validId) {
      fetchInvoiceEvent({ id })
    }

    return () => {
      resetInvoiceEvent()
    }
  }, [id, validId, fetchInvoiceEvent, resetInvoiceEvent])

  const failureKind = validId ? failure : 'not-found'
  const head = buildInvoiceHead(
    {
      project: invoice?.title,
      amount: invoice ? formatCurrency(invoice.totalAmount) : null,
      isPaid: invoice?.state === 'PAID',
      failure: failureKind,
    },
    t,
  )

  // Back goes where the visitor came from - the list, the dashboard, a
  // project dialog - and only falls back to the list on a fresh tab.
  const goBack = () => {
    if (location.key === 'default') {
      navigate(routes.invoices.build())
    } else {
      navigate(-1)
    }
  }

  return (
    <Root width="document">
      <InvoicePrintGlobalStyle />
      <PageHelmet title={head.title} description={head.description} noindex />
      {failureKind === 'not-found' ? (
        <StateNotice
          size="page"
          title={t('invoice.notFound.title')}
          description={t('invoice.notFound.description')}
          actions={
            <Button size="l" onClick={() => navigate(routes.invoices.build())}>
              {t('invoice.notFound.action')}
            </Button>
          }
        />
      ) : failureKind === 'failed' ? (
        <LoadFailure
          size="page"
          title={t('invoice.loadFailure.title')}
          onRetry={() => id && fetchInvoiceEvent({ id })}
        />
      ) : (
        <Body>
          {/* The back arrow shares a row with the title rather than sitting
              alone above it, and the title is set like the other pages'. */}
          {isMobile && (
            <MobileHead>
              <TitleRow>
                <BackButton
                  variant={'ghost'}
                  radius={'full'}
                  color={'gray'}
                  aria-label={t('common.back')}
                  onClick={goBack}
                >
                  <ArrowLeftIcon />
                </BackButton>
                {loading ? (
                  <Skeleton width="150px" height="24px" />
                ) : (
                  <PageTitle>{invoice?.title}</PageTitle>
                )}
              </TitleRow>
              {loading ? (
                <Skeleton width="200px" height="20px" />
              ) : (
                <Reference color={'gray'} size={'2'}>
                  {t('invoices.item.reference')} {invoice?.id}
                </Reference>
              )}
            </MobileHead>
          )}
          {isMobile ? (
            <InvoiceCard shadow={false}>
              <InvoiceTotalAmountMobile />
            </InvoiceCard>
          ) : (
            <InvoiceTotalAmountDesktop />
          )}
          <InvoiceTime />
        </Body>
      )}
    </Root>
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

    header,
    ol[data-sonner-toaster] {
      display: none;
    }
  }
`

const Root = styled(Wrapper)`
  @media print {
    max-width: none;
    margin: 0;
    padding: 0;
    border-radius: 0;
  }
`

const Body = styled.div`
  display: grid;
  gap: 20px;
  min-width: 0;
`

const MobileHead = styled.div`
  display: grid;
  gap: var(--space-1);
`

const TitleRow = styled.div`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: var(--space-2);

  @media print {
    grid-template-columns: minmax(0, 1fr);
  }
`

const BackButton = styled(IconButton)`
  @media print {
    display: none;
  }
`

const InvoiceCard = styled(Card)`
  ${(p) => p.theme.breakpoints.down('md')} {
    padding: 12px;
  }
`

/* An id has no break opportunities of its own; without this a long one
   pushes the page wider than the phone. */
const Reference = styled(Text)`
  overflow-wrap: anywhere;
`
