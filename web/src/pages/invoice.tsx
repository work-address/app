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
  WorkspacePage,
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

/* The side margins are the page's own padding (see Root below), not @page's: a
   print dialog left on "Margins: None" drops @page's and runs the invoice into
   the paper's edge. */
const InvoicePrintGlobalStyle = createGlobalStyle`
  @media print {
    @page {
      size: A4;
      margin: 12mm 0;
    }

    html,
    body,
    #root {
      height: auto;
      overflow: visible;
      background: var(--ui-surface);
    }

    ol[data-sonner-toaster] {
      display: none;
    }
  }
`

const Root = styled(WorkspacePage)`
  @media print {
    /* Paper reads closer than a screen, so the type comes down a step for all
       of the invoice at once. Everything set in these sizes follows. */
    --font-size-1: 10px;
    --line-height-1: 14px;
    --font-size-2: 11px;
    --line-height-2: 15px;
    --font-size-3: 12px;
    --line-height-3: 16px;
    --ui-small-size: 10px;
    --ui-small-line-height: 14px;
    --ui-meta-size: 11px;
    --ui-meta-line-height: 15px;
    --ui-body-size: 12px;
    --ui-body-line-height: 16px;

    /* Inherited, so the state badge and the rejection notice keep their colour
       with the dialog's "Background graphics" off. */
    print-color-adjust: exact;

    && {
      min-height: 0;
      max-width: none;
      margin: 0;
      padding: 0 12mm;
      border-radius: 0;
    }
  }
`

const Body = styled(motion.div)`
  display: grid;
  gap: var(--ui-section-gap);
  min-width: 0;

  /* Blocks, not a grid: only blocks break across pages in every browser. */
  @media print {
    display: block;

    > * + * {
      margin-top: var(--ui-space-5);
    }
  }
`

const Worklogs = styled(motion.div)`
  min-width: 0;
`
