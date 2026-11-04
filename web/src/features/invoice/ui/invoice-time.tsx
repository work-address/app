import { Badge, Flex } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { memo, useContext, useEffect, useMemo, useState } from 'react'
import { flushSync } from 'react-dom'
import { useTranslation } from 'react-i18next'
import styled, { css } from 'styled-components'

import {
  $invoiceTime,
  $invoiceLoading,
  DEFAULT_WORKLOG_SORT,
  nextWorklogCount,
  sortInvoiceWorklogs,
  WORKLOG_PAGE_ROWS,
  WORKLOG_SORT_FIELDS,
  type WorklogSort,
  type WorklogSortField,
} from '../model'

import { InvoiceSection } from './invoice-section'
import { InvoiceTimeContext } from './invoice-time-context'

import type { InvoiceTimeContextProps } from './invoice-time-context'
import type { InvoiceRead } from '../model'
import type {
  DataTableConfig,
  DesktopBodyCellRenderProps,
  MobileBodyRenderProps,
  MobileDataTableConfig,
  MobileHeaderRenderProps,
  SortOrder,
} from '@/shared'

import {
  DataTable,
  formatCount,
  formatDurationFromMinutes,
  getTimeActiveColor,
  MobileDataTable,
  SortSelect,
  Text,
  useBreakpoint,
  useReachEnd,
} from '@/shared'

export const InvoiceTime = () => {
  const { t, i18n } = useTranslation()

  const { timeEntries, loading } = useUnit({
    timeEntries: $invoiceTime,
    loading: $invoiceLoading,
  })

  const isMobile = useBreakpoint('isMobile')

  const [shownCount, setShownCount] = useState(WORKLOG_PAGE_ROWS)
  const [printing, setPrinting] = useState(false)
  const [sort, setSort] = useState<WorklogSort>(DEFAULT_WORKLOG_SORT)

  const sortedEntries = useMemo(
    () => sortInvoiceWorklogs(timeEntries, sort),
    [timeEntries, sort],
  )

  const sortOptions = useMemo(
    () =>
      WORKLOG_SORT_FIELDS.map((entry) => ({
        value: entry.field,
        label: t(entry.labelKey),
      })),
    [t],
  )

  const [sortField, sortOrder] = Object.entries(sort)[0] as [
    WorklogSortField,
    SortOrder,
  ]

  // Another invoice's entries, or another order, start from the top again.
  useEffect(() => setShownCount(WORKLOG_PAGE_ROWS), [timeEntries, sort])

  // Paper gets every entry: an invoice printed with only the rows scrolled to
  // so far is not a record of anything - and gets them as the table, even from
  // a phone, where the screen shows collapsed rows. flushSync renders the rest
  // before the browser lays the page out for print.
  useEffect(() => {
    const beforePrint = () => flushSync(() => setPrinting(true))
    const afterPrint = () => setPrinting(false)

    window.addEventListener('beforeprint', beforePrint)
    window.addEventListener('afterprint', afterPrint)

    return () => {
      window.removeEventListener('beforeprint', beforePrint)
      window.removeEventListener('afterprint', afterPrint)
    }
  }, [])

  const visibleEntries = printing
    ? sortedEntries
    : sortedEntries.slice(0, shownCount)
  const hasMore = visibleEntries.length < timeEntries.length

  const sentinelRef = useReachEnd({
    onReachEnd: hasMore
      ? () =>
          setShownCount((shown) => nextWorklogCount(shown, timeEntries.length))
      : undefined,
    resetKey: visibleEntries.length,
  })

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
        sortable: true,
      },
      {
        dataKey: 'note',
        width: 240,
        headerText: t('dashboard.worklogsTable.head.note'),
        sortable: true,
      },
      {
        customKey: 'timeActive',
        width: 120,
        headerText: t('dashboard.worklogsTable.head.timeActive'),
        sortable: true,
      },
      {
        dataKey: 'keyboardKeys',
        width: 110,
        headerText: t('dashboard.worklogsTable.head.keyboard'),
        getValue: (row) => formatCount(row.keyboardKeys),
        sortable: true,
      },
      {
        dataKey: 'mouseKeys',
        width: 110,
        headerText: t('dashboard.worklogsTable.head.mouse'),
        getValue: (row) => formatCount(row.mouseKeys),
        sortable: true,
      },
      {
        dataKey: 'mouseDistance',
        width: 140,
        headerText: t('dashboard.worklogsTable.head.mouseDistance'),
        getValue: (row) => formatCount(row.mouseDistance),
        sortable: true,
      },
    ],
    [t],
  )

  // The time and the active minutes are the row; the rest is one tap away. A
  // table this wide would leave a phone scrolling sideways for its figures.
  const mobileConfig = useMemo(
    (): MobileDataTableConfig<InvoiceTimeRow> => [
      { customKey: 'entry', isTitle: true },
      {
        dataKey: 'note',
        headerText: t('dashboard.worklogsTable.head.note'),
      },
      {
        dataKey: 'keyboardKeys',
        headerText: t('dashboard.worklogsTable.head.keyboard'),
        getValue: (row) => formatCount(row.keyboardKeys),
      },
      {
        dataKey: 'mouseKeys',
        headerText: t('dashboard.worklogsTable.head.mouse'),
        getValue: (row) => formatCount(row.mouseKeys),
      },
      {
        dataKey: 'mouseDistance',
        headerText: t('dashboard.worklogsTable.head.mouseDistance'),
        getValue: (row) => formatCount(row.mouseDistance),
      },
    ],
    [t],
  )

  // A rejected invoice releases its entries: nothing left to evidence, so no
  // heading over an empty table.
  if (!loading && timeEntries.length === 0) {
    return null
  }

  return (
    <InvoiceSection
      title={t('dashboard.page.worklogs.title')}
      meta={
        !loading && timeEntries.length > 0 ? (
          <Text size="2" color="gray">
            {t('invoice.worklogs.count', { count: timeEntries.length })}
          </Text>
        ) : null
      }
    >
      <InvoiceTimeContext value={contextValue}>
        {/* A phone's rows have no column headers to sort from. */}
        {isMobile && !printing && timeEntries.length > 1 ? (
          <Flex pb="3">
            <SortSelect
              options={sortOptions}
              field={sortField}
              order={sortOrder}
              onChange={(field, order) => setSort({ [field]: order })}
            />
          </Flex>
        ) : null}
        {isMobile && !printing ? (
          <InvoiceTimeRows
            loading={loading}
            data={visibleEntries}
            config={mobileConfig}
            getRowId={rowIdGetter}
            HeaderComponent={MobileEntryHeader}
            BodyComponent={MobileEntryBody}
          />
        ) : (
          <InvoiceTimeTable
            shadow={false}
            loading={loading}
            data={visibleEntries}
            config={tableConfig}
            getRowId={rowIdGetter}
            sort={sort}
            onSortChange={setSort}
            verticalAlign={'middle'}
            BodyComponent={Cell}
            nowrap
            height={timeEntries.length > 0 ? '' : '340px'}
          />
        )}
      </InvoiceTimeContext>
      {/* Rendered only with more to come, so a finished list asks for nothing. */}
      {hasMore && <Sentinel ref={sentinelRef} aria-hidden="true" />}
    </InvoiceSection>
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

const MobileEntryHeader = (props: MobileHeaderRenderProps<InvoiceTimeRow>) => {
  const { t } = useTranslation()
  const { dateFormatter, timeFormatter } = useContext(InvoiceTimeContext)

  return (
    <MobileEntry>
      <div>
        <Text as="div" size="2" weight="medium">
          {formatDate(timeFormatter, props.data.fromAt)} -{' '}
          {formatDate(timeFormatter, props.data.toAt)}
        </Text>
        <Text as="div" size="1" color="gray">
          {formatDate(dateFormatter, props.data.createdAt)}
        </Text>
      </div>
      <Badge color={getTimeActiveColor(props.data.minutesActive ?? 0)}>
        {formatDurationFromMinutes(props.data.minutesActive ?? 0, t)}
      </Badge>
    </MobileEntry>
  )
}

/** Most entries have no note, and a label over nothing is noise. */
const MobileEntryBody = (props: MobileBodyRenderProps<InvoiceTimeRow>) =>
  props.dataKey === 'note' && !props.data.note ? null : (
    <props.DefaultBodyComponent {...props} />
  )

/** Blank beats "Invalid Date" on a printed invoice. */
const formatDate = (
  formatter: Intl.DateTimeFormat,
  value: string | undefined,
): string => (value ? formatter.format(new Date(value)) : '')

const CreatedAtCell = memo(
  (props: DesktopBodyCellRenderProps<InvoiceTimeRow>) => {
    const { dateFormatter, timeFormatter } = useContext(InvoiceTimeContext)

    return (
      <EntryWhen gap={'2'}>
        <Text size="2">
          {formatDate(timeFormatter, props.data.fromAt)} -{' '}
          {formatDate(timeFormatter, props.data.toAt)}
        </Text>
        <Text size="2" color={'gray'}>
          {formatDate(dateFormatter, props.data.createdAt)}
        </Text>
      </EntryWhen>
    )
  },
)

/* One line on screen; a printed column is narrow, and a date broken in the
   middle of its digits is unreadable, so paper moves it below the time whole. */
const EntryWhen = styled(Flex)`
  @media print {
    flex-wrap: wrap;
    row-gap: 0;
  }
`

const MobileEntry = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-2);
  padding-right: var(--space-2);
  flex: 1;
`

const Sentinel = styled.div`
  height: 1px;

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

/* The section's header carries the inset on a phone; rows keep to it. */
const InvoiceTimeRows = styled(MobileDataTable<InvoiceTimeRow>)`
  && {
    padding: 0;
  }
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

  /* The outer cells keep to the card's inset, level with the title above. */
  @media screen {
    && th:first-child,
    && td:first-child {
      padding-left: var(--space-5);
    }

    && th:last-child,
    && td:last-child {
      padding-right: var(--space-5);
    }
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
