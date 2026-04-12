import { Badge, Flex } from '@radix-ui/themes'
import { memo, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type {
  DesktopBodyCellRenderProps,
  DataTableConfig,
} from '@/features/shared'

import {
  DataTable,
  formatDurationFromMinutes,
  worklogsMock,
  Text,
} from '@/features/shared'

type WorklogRow = (typeof worklogsMock)[number]

export const Worklogs = () => {
  const { t } = useTranslation()
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({})

  const tableConfig = useMemo(
    (): DataTableConfig<WorklogRow> => [
      {
        dataKey: 'date',
        width: 165,
        headerText: t('dashboard.worklogsTable.head.date'),
      },
      {
        dataKey: 'projectName',
        width: 240,
        headerText: t('dashboard.worklogsTable.head.projectName'),
      },
      {
        dataKey: 'note',
        width: 240,
        headerText: t('dashboard.worklogsTable.head.note'),
      },
      {
        dataKey: 'timeActive',
        width: 130,
        headerText: t('dashboard.worklogsTable.head.timeActive'),
        horizontalAlign: 'center',
      },
      {
        dataKey: 'keyboard',
        width: 118,
        headerText: t('dashboard.worklogsTable.head.keyboard'),
      },
      {
        dataKey: 'mouse',
        headerText: t('dashboard.worklogsTable.head.mouse'),
      },
      {
        dataKey: 'mouseDistance',
        width: 155,
        headerText: t('dashboard.worklogsTable.head.mouseDistance'),
      },
    ],
    [t],
  )

  return (
    <>
      <Text size={'5'}>{t('dashboard.page.worklogs.title')}</Text>

      <DataTable
        data={worklogsMock}
        config={tableConfig}
        getRowId={(row) => row.key}
        verticalAlign={'middle'}
        BodyComponent={Cell}
        allowSelection
        selectedIds={selectedIds}
        onSelectedIdsChange={setSelectedIds}
        nowrap
      />
    </>
  )
}

const Cell = memo((props: DesktopBodyCellRenderProps<WorklogRow>) => {
  const { t } = useTranslation()
  switch (props.dataKey) {
    case 'date': {
      return (
        <Flex direction={'column'}>
          <Text>{props.data.dateRange}</Text>
          <Text color={'gray'}>{props.data.date}</Text>
        </Flex>
      )
    }

    case 'timeActive': {
      return (
        <Badge
          color={
            Number(props.data.key) % 3 === 0
              ? 'red'
              : Number(props.data.key) % 5 === 0
                ? 'orange'
                : 'green'
          }
        >
          {formatDurationFromMinutes(props.data.timeActive, t)}
        </Badge>
      )
    }

    default: {
      return <props.DefaultBodyComponent {...props} />
    }
  }
})
