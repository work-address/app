import { Badge, Flex } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { memo, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink, useNavigate } from 'react-router-dom'
import styled from 'styled-components'

import {
  canSettleInvoice,
  invoiceRateHour,
  invoiceStateColor,
  invoiceStateLabelKey,
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
import { DataTable, formatCurrency, Text, useDateFormatter } from '@/shared'

type InvoiceRow = baseApi.InvoiceSearch

const PROJECT_COLUMN_WIDTH = 200
const ISSUER_COLUMN_WIDTH = 136
/** What's left of a truncated column once the cell's own padding is out. */
const CELL_INSET = 24

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

  const config = useMemo(
    (): DataTableConfig<InvoiceRow> => [
      {
        customKey: 'projectName',
        headerText: t('invoices.item.project'),
        width: PROJECT_COLUMN_WIDTH,
        truncate: true,
        sortable: true,
        // The invoice's name stays in view while a narrow window scrolls.
        sticky: 'left',
      },
      {
        dataKey: 'state',
        headerText: t('invoices.item.status'),
        width: 150,
        sortable: true,
      },
      {
        customKey: 'issuedBy',
        headerText: t('invoices.item.issuedBy'),
        width: ISSUER_COLUMN_WIDTH,
        truncate: true,
        sortable: true,
      },
      {
        dataKey: 'fromAt',
        headerText: t('invoices.item.period'),
        width: 168,
        sortable: true,
      },
      {
        dataKey: 'createdAt',
        headerText: t('invoices.item.issued'),
        width: 120,
        sortable: true,
      },
      {
        dataKey: 'amountCents',
        headerText: t('invoices.item.amount'),
        horizontalAlign: 'end',
        width: 124,
        sortable: true,
      },
      {
        customKey: 'action',
        headerText: '',
        horizontalAlign: 'end',
        width: 120,
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
      return (
        <Stack $width={PROJECT_COLUMN_WIDTH}>
          {/* A real link inside the clickable row, for the keyboard and for
              opening an invoice in a new tab. */}
          <ProjectLink
            to={routes.invoice.build({ id: invoice.id as string })}
            onClick={(event) => event.stopPropagation()}
          >
            <Text size="3" weight="medium" truncate>
              {invoice.project?.title ?? '—'}
            </Text>
          </ProjectLink>
          <Text size="2" color="gray" truncate>
            {t('invoices.item.reference')} {shortenAddress(invoice.id ?? '')}
          </Text>
        </Stack>
      )
    }

    case 'state': {
      return (
        <Flex direction="column" align="start" gap="1">
          <Badge
            size="2"
            radius="full"
            variant="soft"
            color={invoiceStateColor(invoice)}
          >
            {t(invoiceStateLabelKey(invoice))}
          </Badge>
          {invoice.state === 'PAID' && invoice.paidAt ? (
            <Text size="2" color="gray">
              {dateFormatter.format(new Date(invoice.paidAt))}
            </Text>
          ) : null}
        </Flex>
      )
    }

    case 'issuedBy': {
      return (
        <Stack $width={ISSUER_COLUMN_WIDTH}>
          <Text size="2" truncate>
            {invoice.user?.name || shortenAddress(invoice.user?.address ?? '')}
          </Text>
        </Stack>
      )
    }

    case 'fromAt': {
      return (
        <Text size="2">
          {invoice.fromAt && invoice.toAt
            ? dateFormatter.formatRange(
                new Date(invoice.fromAt),
                new Date(invoice.toAt),
              )
            : '—'}
        </Text>
      )
    }

    case 'createdAt': {
      return (
        <Text size="2">
          {invoice.createdAt
            ? dateFormatter.format(new Date(invoice.createdAt))
            : '—'}
        </Text>
      )
    }

    case 'amountCents': {
      const rateHour = invoiceRateHour(invoice)

      return (
        <Flex direction="column" align="end">
          <Amount size="3" weight="bold">
            {formatCents(Number(invoice.amountCents ?? 0))}
          </Amount>
          {/* The frozen line rate, or the project's rate for an invoice issued
              before lines were stored. */}
          {rateHour != null && (
            <Text size="2" color="gray">
              {t('invoices.item.perHour', { rate: formatCurrency(rateHour) })}
            </Text>
          )}
        </Flex>
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

/* The cell is as wide as its text wants, so the limit truncation needs is set
   here, from the column it sits in. */
const Stack = styled.div<{ $width: number }>`
  display: grid;
  gap: 2px;
  min-width: 0;
  max-width: ${(p) => p.$width - CELL_INSET}px;
`

/* Amounts line up digit for digit down the column. */
const Amount = styled(Text)`
  color: var(--ui-ink);
  font-variant-numeric: tabular-nums;
`

const ProjectLink = styled(NavLink)`
  display: block;
  min-width: 0;
  color: var(--ui-blue);
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }

  &:focus-visible {
    border-radius: var(--ui-inline-radius);
    outline: var(--ui-focus-width) solid var(--ui-blue);
    outline-offset: var(--ui-focus-offset);
  }
`
