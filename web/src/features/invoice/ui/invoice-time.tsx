import { Badge, Flex } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { memo, useContext, useEffect, useMemo, useState } from 'react'
import { flushSync } from 'react-dom'
import { useTranslation } from 'react-i18next'
import styled, { css } from 'styled-components'

import { $invoiceTime, $invoiceLoading } from '../model'

import { InvoiceTimeContext } from './invoice-time-context'

import type { InvoiceTimeContextProps } from './invoice-time-context'
import type { InvoiceRead } from '../model'
import type { DesktopBodyCellRenderProps, DataTableConfig } from '@/shared'

import {
  Button,
  DataTable,
  SectionTitle,
  formatCount,
  formatDurationFromMinutes,
  getTimeActiveColor,
  Text,
} from '@/shared'

/**
 * How many entries the screen shows before "Show all". A month of 10-minute
 * entries runs to hundreds of rows - tens of thousands of pixels of evidence
 * under a summary that already answers the question.
 */
export const INVOICE_TIME_PREVIEW_ROWS = 25

export const InvoiceTime = () => {
  const { t, i18n } = useTranslation()

  const { timeEntries, loading } = useUnit({
    timeEntries: $invoiceTime,
    loading: $invoiceLoading,
  })

  const [expanded, setExpanded] = useState(false)

  // Paper gets every entry: an invoice printed with a "show all" button in
  // place of most of its rows is not a record of anything. flushSync renders
  // the rest before the browser lays the page out for print.
  useEffect(() => {
    const expandForPrint = () => flushSync(() => setExpanded(true))

    window.addEventListener('beforeprint', expandForPrint)

    return () => window.removeEventListener('beforeprint', expandForPrint)
  }, [])

  const visibleEntries = expanded
    ? timeEntries
    : timeEntries.slice(0, INVOICE_TIME_PREVIEW_ROWS)
  const hiddenCount = timeEntries.length - visibleEntries.length

  const contextValue = useMemo<InvoiceTimeContextProps>(
    () => ({
      dateFormatter: new Intl.DateTimeFormat(i18n.language, {
        day: 'numeric',
        month: 'numeric',
        year: 'numeric',
      }),
      timeFormatter: new Intl.DateTimeFormat(i18n.language, {
        hour: 'numeric',
        minute: '2-digit',
      }),
    }),
    [i18n.language],
  )

  const tableConfig = useMemo(
    (): DataTableConfig<InvoiceTimeRow> => [
      {
        dataKey: 'createdAt',
        width: 200,
        headerText: t('dashboard.worklogsTable.head.date'),
      },
      {
        dataKey: 'note',
        width: 240,
        headerText: t('dashboard.worklogsTable.head.note'),
      },
      {
        customKey: 'timeActive',
        width: 120,
        headerText: t('dashboard.worklogsTable.head.timeActive'),
      },
      {
        dataKey: 'keyboardKeys',
        width: 110,
        headerText: t('dashboard.worklogsTable.head.keyboard'),
        getValue: (row) => formatCount(row.keyboardKeys),
      },
      {
        dataKey: 'mouseKeys',
        width: 110,
        headerText: t('dashboard.worklogsTable.head.mouse'),
        getValue: (row) => formatCount(row.mouseKeys),
      },
      {
        dataKey: 'mouseDistance',
        width: 140,
        headerText: t('dashboard.worklogsTable.head.mouseDistance'),
        getValue: (row) => formatCount(row.mouseDistance),
      },
    ],
    [t],
  )

  return (
    <>
      <Heading>
        <SectionTitle>{t('dashboard.page.worklogs.title')}</SectionTitle>
        {!loading && timeEntries.length > 0 ? (
          <Text size="2" color="gray">
            {t('invoice.worklogs.count', { count: timeEntries.length })}
          </Text>
        ) : null}
      </Heading>
      <InvoiceTimeContext value={contextValue}>
        <InvoiceTimeTable
          loading={loading}
          data={visibleEntries}
          config={tableConfig}
          getRowId={rowIdGetter}
          verticalAlign={'middle'}
          BodyComponent={Cell}
          nowrap
          height={timeEntries.length > 0 ? '' : '340px'}
        />
      </InvoiceTimeContext>
      {hiddenCount > 0 ||
      (expanded && timeEntries.length > INVOICE_TIME_PREVIEW_ROWS) ? (
        <More>
          <Button
            size="l"
            variant="outline"
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded
              ? t('invoice.worklogs.showFewer')
              : t('invoice.worklogs.showAll', { count: timeEntries.length })}
          </Button>
        </More>
      ) : null}
    </>
  )
}

/** One billed entry, exactly as the invoice read endpoint serializes it. */
type InvoiceTimeRow = NonNullable<InvoiceRead['time']>[number]

const rowIdGetter = (detail: InvoiceTimeRow) => detail.id ?? ''

const Cell = memo((props: DesktopBodyCellRenderProps<InvoiceTimeRow>) => {
  const { t } = useTranslation()

  if (props.dataKey === 'createdAt') {
    return <CreatedAtCell {...props} />
  }

  if (props.customKey === 'timeActive') {
    return (
      <Badge color={getTimeActiveColor(props.data.minutesActive ?? 0)}>
        {formatDurationFromMinutes(props.data.minutesActive ?? 0, t)}
      </Badge>
    )
  }

  // Notes wrap rather than truncate: this table is the invoice's evidence and
  // goes to paper, where a clipped note is a clipped record.
  if (props.dataKey === 'note') {
    return <NoteText size="2">{props.data.note}</NoteText>
  }

  return (
    <Text size="2">
      <props.DefaultBodyComponent {...props} />
    </Text>
  )
})

/** Blank beats "Invalid Date" on a printed invoice. */
const formatDate = (
  formatter: Intl.DateTimeFormat,
  value: string | undefined,
): string => (value ? formatter.format(new Date(value)) : '')

const CreatedAtCell = memo(
  (props: DesktopBodyCellRenderProps<InvoiceTimeRow>) => {
    const { dateFormatter, timeFormatter } = useContext(InvoiceTimeContext)

    return (
      <Flex gap={'2'}>
        <Text size="2">
          {formatDate(timeFormatter, props.data.fromAt)} -{' '}
          {formatDate(timeFormatter, props.data.toAt)}
        </Text>
        <Text size="2" color={'gray'}>
          {formatDate(dateFormatter, props.data.createdAt)}
        </Text>
      </Flex>
    )
  },
)

const Heading = styled.div`
  display: grid;
  grid-auto-flow: column;
  justify-content: start;
  align-items: baseline;
  gap: var(--space-3);
`

const More = styled.div`
  display: grid;
  justify-content: center;

  @media print {
    display: none;
  }
`

const NoteText = styled(Text)`
  display: block;
  white-space: normal;
  overflow-wrap: anywhere;
`

// Print column widths, in the same order as `tableConfig` above:
// date | note | time | keyboard | mouse | distance
const PRINT_COLUMN_WIDTHS = ['20%', '28%', '15%', '12%', '12%', '12%']

const printColumnWidths = css`
  ${PRINT_COLUMN_WIDTHS.map(
    (width, index) => css`
      && th:nth-child(${index + 1}),
      && td:nth-child(${index + 1}) {
        width: ${width};
      }
    `,
  )}
`

const InvoiceTimeTable = styled(DataTable<InvoiceTimeRow>)`
  /* DataTable's shared Tr (src/shared/ui/table/data-table.tsx) applies a 0.25s
     transition and an rgb(242, 242, 242) hover background to every row; this
     printable summary table isn't interactive, so neutralize both. */
  && tr {
    transition: none;
  }

  && tr:hover td {
    background-color: var(--white) !important;
  }

  @media print {
    overflow: visible;
    max-height: none;
    height: auto;
    box-shadow: none;
    break-inside: auto;

    /* DataTable's base rules (fixed sticky headers/cells, nowrap, flex-based
       scroll container) target screen rendering; double the class here to win
       over them and lay the table out for paper instead. */
    && table {
      table-layout: fixed;
      width: 100%;
      font-size: 11px;
      white-space: normal;
    }

    && th,
    && td {
      position: static;
      min-width: 0;
      padding: 6px 8px;
      white-space: normal;
      word-break: break-word;
      line-height: 1.3;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    ${printColumnWidths}

    && tr {
      break-inside: avoid;
      page-break-inside: avoid;
    }

    && thead {
      display: table-header-group;
    }

    && * {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
  }
`
