import { useUnit } from 'effector-react'
import { memo, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink, useNavigate } from 'react-router-dom'
import styled from 'styled-components'

import {
  canSettleInvoice,
  invoiceRateHour,
  invoiceStateLabelKey,
  invoiceStateTone,
} from '../lib'
import {
  $invoiceSort,
  formatCents,
  invoiceSortChanged,
  shortenAddress,
} from '../model'

import { InvoicePaymentActions } from './invoice-payment-actions'

import type {
  baseApi,
  DataTableConfig,
  DesktopBodyCellRenderProps,
} from '@/shared'

import { $user } from '@/entities/profile'
import { routes } from '@/routes'
import {
  DataTable,
  formatCurrency,
  useDateFormatter,
  WorkspaceStatus,
} from '@/shared'

type InvoiceRow = baseApi.InvoiceSearch

const COLUMN_WIDTHS = {
  period: 196,
  status: 176,
  amount: 148,
  action: 136,
} as const

const rowIdGetter = (row: InvoiceRow) => row.id ?? ''

/**
 * The invoice list as a table: set, sorted and opened the way the worklogs
 * table is. The rows come from the page, which also serves them to a phone as
 * cards; the order lives in the model, and the server applies it, because the
 * list holds only the pages scrolled to so far.
 */
export const InvoicesTable = ({
  rows,
  loading,
}: {
  rows: InvoiceRow[]
  loading: boolean
}) => {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const { sort, changeSort } = useUnit({
    sort: $invoiceSort,
    changeSort: invoiceSortChanged,
  })

  // The project column takes what the others leave, so the list fits a 1280px
  // window. The issuer and the issue date ride under the project and the
  // period, as in the reference; the sort picker above still sorts by both.
  const config = useMemo(
    (): DataTableConfig<InvoiceRow> => [
      {
        customKey: 'projectName',
        headerText: t('invoices.item.project'),
        sortable: true,
      },
      {
        dataKey: 'fromAt',
        headerText: t('invoices.item.period'),
        width: COLUMN_WIDTHS.period,
        sortable: true,
      },
      {
        dataKey: 'state',
        headerText: t('invoices.item.status'),
        width: COLUMN_WIDTHS.status,
        sortable: true,
      },
      {
        dataKey: 'amountCents',
        headerText: t('invoices.item.amount'),
        horizontalAlign: 'end',
        width: COLUMN_WIDTHS.amount,
        sortable: true,
      },
      {
        customKey: 'action',
        headerText: '',
        horizontalAlign: 'end',
        width: COLUMN_WIDTHS.action,
      },
    ],
    [t],
  )

  return (
    <DataTable<InvoiceRow>
      nowrap
      shadow={false}
      rounded={false}
      data={rows}
      config={config}
      getRowId={rowIdGetter}
      BodyComponent={InvoiceCell}
      verticalAlign="middle"
      loading={loading}
      sort={sort}
      onSortChange={changeSort}
      onRowClick={(row) =>
        navigate(routes.invoice.build({ id: row.id as string }))
      }
      skeletonHeight="40px"
    />
  )
}

const InvoiceCell = memo((props: DesktopBodyCellRenderProps<InvoiceRow>) => {
  const { t } = useTranslation()
  const dateFormatter = useDateFormatter()
  const invoice = props.data

  switch (props.dataKey ?? props.customKey) {
    case 'projectName': {
      const issuer =
        invoice.user?.name || shortenAddress(invoice.user?.address ?? '')

      return (
        <Stack>
          {/* A real link inside the clickable row, for the keyboard and for
              opening an invoice in a new tab. */}
          <ProjectLink
            to={routes.invoice.build({ id: invoice.id as string })}
            onClick={(event) => event.stopPropagation()}
          >
            {invoice.project?.title ?? '—'}
          </ProjectLink>
          {/* Who issued it first: the reference is the long, opaque part. */}
          <Meta title={`${t('invoices.item.reference')} ${invoice.id ?? ''}`}>
            {issuer ? `${issuer} · ` : null}
            {shortenAddress(invoice.id ?? '')}
          </Meta>
        </Stack>
      )
    }

    case 'state': {
      return (
        <Stack data-align="start">
          <WorkspaceStatus tone={invoiceStateTone(invoice)}>
            {t(invoiceStateLabelKey(invoice))}
          </WorkspaceStatus>
          {invoice.state === 'PAID' && invoice.paidAt ? (
            <Meta>{dateFormatter.format(new Date(invoice.paidAt))}</Meta>
          ) : null}
        </Stack>
      )
    }

    case 'fromAt': {
      return (
        <Stack>
          <Value>
            {invoice.fromAt && invoice.toAt
              ? dateFormatter.formatRange(
                  new Date(invoice.fromAt),
                  new Date(invoice.toAt),
                )
              : '—'}
          </Value>
          {invoice.createdAt ? (
            <Meta>
              {t('invoices.item.issued')}{' '}
              {dateFormatter.format(new Date(invoice.createdAt))}
            </Meta>
          ) : null}
        </Stack>
      )
    }

    case 'amountCents': {
      const rateHour = invoiceRateHour(invoice)

      return (
        <Stack data-align="end">
          <Amount>{formatCents(Number(invoice.amountCents ?? 0))}</Amount>
          {/* The frozen line rate, or the project's rate for an invoice issued
              before lines were stored. */}
          {rateHour != null && (
            <Meta>
              {t('invoices.item.perHour', { rate: formatCurrency(rateHour) })}
            </Meta>
          )}
        </Stack>
      )
    }

    case 'action': {
      return <InvoiceActionCell invoice={invoice} />
    }

    default: {
      return null
    }
  }
})

const InvoiceActionCell = ({ invoice }: { invoice: InvoiceRow }) => {
  const user = useUnit($user)

  return (
    // Settling an invoice is not opening it.
    <div onClick={(event) => event.stopPropagation()}>
      <InvoicePaymentActions
        invoiceId={invoice.id as string}
        isPaid={invoice.state === 'PAID'}
        canSettle={canSettleInvoice(invoice, user)}
      />
    </div>
  )
}

const Stack = styled.div`
  display: grid;
  justify-items: start;
  gap: var(--ui-space-1);
  min-width: 0;

  &[data-align='end'] {
    justify-items: end;
    text-align: end;
  }
`

const Value = styled.span`
  color: var(--ui-text);
  font-size: var(--ui-meta-size);
  line-height: var(--ui-meta-line-height);
`

const Meta = styled.span`
  max-width: 100%;
  overflow: hidden;
  color: var(--ui-muted);
  font-size: var(--ui-meta-size);
  line-height: var(--ui-meta-line-height);
  text-overflow: ellipsis;
  white-space: nowrap;
`

/* Amounts line up digit for digit down the column. */
const Amount = styled.span`
  color: var(--ui-ink);
  font-size: var(--ui-body-size);
  line-height: var(--ui-body-line-height);
  font-weight: var(--ui-weight-semibold);
  font-variant-numeric: tabular-nums;
`

/* The project names the invoice: navy and strong, blue only as a link. */
const ProjectLink = styled(NavLink)`
  display: block;
  max-width: 100%;
  overflow: hidden;
  color: var(--ui-ink);
  font-size: var(--ui-body-size);
  line-height: var(--ui-body-line-height);
  font-weight: var(--ui-weight-semibold);
  text-decoration: none;
  text-overflow: ellipsis;
  white-space: nowrap;

  &:hover {
    color: var(--ui-blue);
    text-decoration: underline;
  }

  &:focus-visible {
    border-radius: var(--ui-inline-radius);
    outline: var(--ui-focus-width) solid var(--ui-blue);
    outline-offset: var(--ui-focus-offset);
  }
`
