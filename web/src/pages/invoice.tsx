import { useUnit } from 'effector-react'
import { motion, useReducedMotion } from 'motion/react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import styled, { createGlobalStyle } from 'styled-components'

import {
  fetchInvoice,
  $invoice,
  $invoiceFailure,
  buildInvoiceHead,
  resetInvoice,
  InvoiceOverview,
  InvoiceTime,
  InvoiceLines,
} from '@/features/invoice'
import { routes } from '@/routes'
import {
  Button,
  formatCurrency,
  isRecordId,
  LoadFailure,
  PageHelmet,
  StateNotice,
  Wrapper,
} from '@/shared'

export default function InvoicePage() {
  const { id } = useParams<{ id: string }>()
  // A malformed id cannot name an invoice; say so without asking the API,
  // which answers one with a 500 rather than a 404.
  const validId = isRecordId(id)

  const { fetchInvoiceEvent, invoice, failure, resetInvoiceEvent } = useUnit({
    fetchInvoiceEvent: fetchInvoice,
    invoice: $invoice,
    failure: $invoiceFailure,
    resetInvoiceEvent: resetInvoice,
  })

  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()

  // The blocks arrive one after another, as the dashboard's do; with reduced
  // motion they simply appear.
  const reducedMotion = useReducedMotion()
  const reveal = reducedMotion ? REVEAL_STILL : REVEAL

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
    <Root>
      <InvoicePrintGlobalStyle />
      <PageHelmet title={head.title} description={head.description} />
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
        <Body initial="hidden" animate="shown" variants={reveal.list}>
          <motion.div variants={reveal.item}>
            <InvoiceOverview onBack={goBack} />
          </motion.div>
          <motion.div variants={reveal.item}>
            <InvoiceLines />
          </motion.div>
          <Worklogs variants={reveal.item}>
            <InvoiceTime />
          </Worklogs>
        </Body>
      )}
    </Root>
  )
}

const REVEAL = {
  list: { shown: { transition: { staggerChildren: 0.06 } } },
  item: {
    hidden: { opacity: 0, y: 8 },
    shown: { opacity: 1, y: 0, transition: { duration: 0.24 } },
  },
}

const REVEAL_STILL = {
  list: {},
  item: { hidden: { opacity: 1 }, shown: { opacity: 1 } },
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

const Body = styled(motion.div)`
  display: grid;
  gap: var(--space-5);
  min-width: 0;
`

const Worklogs = styled(motion.div)`
  min-width: 0;
`
