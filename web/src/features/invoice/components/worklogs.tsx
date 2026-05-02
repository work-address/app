import { Badge, Flex } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { memo, useContext, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { WorklogsContext } from './worklogs-context'

import type { WorklogsContextProps } from './worklogs-context'
import type { DesktopBodyCellRenderProps, DataTableConfig } from '@/shared'

import {
  $invoice,
  $invoiceWorklogs,
  $invoiceLoading,
  type ITimeTotalDetail,
} from '@/entities/activities'
import {
  formatDurationFromMinutes,
  getTimeActiveColor,
  DataTable,
  Text,
  WorklogsEmptyState,
} from '@/shared'

export const Worklogs = () => {
  const { t, i18n } = useTranslation()
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({})

  const { worklogs, invoice, loading } = useUnit({
    worklogs: $invoiceWorklogs,
    invoice: $invoice,
    loading: $invoiceLoading,
  })

  const showSkeletons = loading || worklogs.length > 0

  const contextValue = useMemo<WorklogsContextProps>(
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
        width: 165,
        headerText: t('dashboard.worklogsTable.head.date'),
      },
      {
        customKey: 'projectName',
        getValue: () => invoice?.title,
        width: 240,
        headerText: t('dashboard.worklogsTable.head.projectName'),
      },
      {
        dataKey: 'note',
        width: 240,
        headerText: t('dashboard.worklogsTable.head.note'),
      },
      {
        customKey: 'timeActive',
        width: 130,
        headerText: t('dashboard.worklogsTable.head.timeActive'),
        horizontalAlign: 'center',
      },
      {
        dataKey: 'keyboardKeys',
        width: 118,
        headerText: t('dashboard.worklogsTable.head.keyboard'),
      },
      {
        dataKey: 'mouseKeys',
        headerText: t('dashboard.worklogsTable.head.mouse'),
      },
      {
        dataKey: 'mouseDistance',
        width: 155,
        headerText: t('dashboard.worklogsTable.head.mouseDistance'),
      },
    ],
    [t, invoice],
  )

  return (
    <>
      <Text size={'5'}>{t('dashboard.page.worklogs.title')}</Text>

      {loading ? (
        <WorklogsContext value={contextValue}>
          <DataTable
            loading={showSkeletons}
            data={worklogs}
            config={tableConfig}
            getRowId={rowIdGetter}
            verticalAlign={'middle'}
            BodyComponent={Cell}
            allowSelection
            selectedIds={selectedIds}
            onSelectedIdsChange={setSelectedIds}
            nowrap
          />
        </WorklogsContext>
      ) : (
        <Flex pt="1" pb="4">
          <WorklogsEmptyState />
        </Flex>
      )}
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
    const { dateFormatter, timeFormatter } = useContext(WorklogsContext)

    return (
      <Flex direction={'column'}>
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
