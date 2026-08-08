import { Badge, Flex } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { memo, useContext, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import styled, { css } from 'styled-components'

import { $invoiceTime, $invoiceLoading } from '../model'

import { InvoiceTimeContext } from './invoice-time-context'

import type { InvoiceTimeContextProps } from './invoice-time-context'
import type { DesktopBodyCellRenderProps, DataTableConfig } from '@/shared'

import { type ITimeTotalDetail } from '@/entities/time'
import {
  DataTable,
  formatDurationFromMinutes,
  getTimeActiveColor,
  Text,
} from '@/shared'

export const InvoiceTime = () => {
  const { t, i18n } = useTranslation()

  const { timeEntries, loading } = useUnit({
    timeEntries: $invoiceTime,
    loading: $invoiceLoading,
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
    (): DataTableConfig<ITimeTotalDetail> => [
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
        headerText: t('dashboard.worklogsTable.head.timeActive'),
      },
      {
        dataKey: 'keyboardKeys',
        headerText: t('dashboard.worklogsTable.head.keyboard'),
      },
      {
        dataKey: 'mouseKeys',
        headerText: t('dashboard.worklogsTable.head.mouse'),
      },
      {
        dataKey: 'mouseDistance',
        headerText: t('dashboard.worklogsTable.head.mouseDistance'),
      },
    ],
    [t],
  )

  return (
    <>
      <Text size={'5'}>{t('dashboard.page.worklogs.title')}</Text>
      <InvoiceTimeContext value={contextValue}>
        <InvoiceTimeTable
          loading={loading}
          data={timeEntries}
          config={tableConfig}
          getRowId={rowIdGetter}
          verticalAlign={'middle'}
          BodyComponent={Cell}
          nowrap
          height={timeEntries.length > 0 ? '' : '340px'}
        />
      </InvoiceTimeContext>
    </>
  )
}

const rowIdGetter = (detail: ITimeTotalDetail) => detail.id

const Cell = memo((props: DesktopBodyCellRenderProps<ITimeTotalDetail>) => {
  const { t } = useTranslation()

  if (props.dataKey === 'createdAt') {
    return <CreatedAtCell {...props} />
  }

  if (props.customKey === 'timeActive') {
    return (
      <Badge color={getTimeActiveColor(props.data.minutesActive ?? 0)}>
        {formatDurationFromMinutes(props.data.minutesActive, t)}
      </Badge>
    )
  }

  return (
    <Text size="2">
      <props.DefaultBodyComponent {...props} />
    </Text>
  )
})

const CreatedAtCell = memo(
  (props: DesktopBodyCellRenderProps<ITimeTotalDetail>) => {
    const { dateFormatter, timeFormatter } = useContext(InvoiceTimeContext)

    return (
      <Flex gap={'2'}>
        <Text size="2">
          {timeFormatter.format(new Date(props.data.fromAt))} -{' '}
          {timeFormatter.format(new Date(props.data.toAt))}
        </Text>
        <Text size="2" color={'gray'}>
          {dateFormatter.format(new Date(props.data.createdAt))}
        </Text>
      </Flex>
    )
  },
)

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

const InvoiceTimeTable = styled(DataTable<ITimeTotalDetail>)`
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
