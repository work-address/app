import { Badge, Flex } from '@radix-ui/themes'
import { memo, useMemo, useState } from 'react'

import type {
  DesktopBodyCellRenderProps,
  DataTableConfig,
} from '@/features/shared'

import { DataTable } from '@/features/shared'
import { worklogsMock, Text } from '@/features/shared'

type WorklogRow = (typeof worklogsMock)[number]

export const Worklogs = () => {
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({})

  const tableConfig = useMemo(
    (): DataTableConfig<WorklogRow> => [
      {
        dataKey: 'date',
        width: 165,
        headerText: 'Date',
      },
      {
        dataKey: 'projectName',
        width: 240,
        headerText: 'Project name',
      },
      {
        dataKey: 'note',
        width: 240,
        headerText: 'Note',
      },
      {
        dataKey: 'timeActive',
        width: 130,
        headerText: 'Time active',
        horizontalAlign: 'center',
      },
      {
        dataKey: 'keyboard',
        width: 118,
        headerText: 'Keyboard',
      },
      {
        dataKey: 'mouse',
        headerText: 'Mouse',
      },
      {
        dataKey: 'mouseDistance',
        width: 155,
        headerText: 'Mouse distance',
      },
    ],
    [],
  )

  return (
    <>
      <Text size={'5'}>Worklogs</Text>

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
          {props.data.timeActive}
        </Badge>
      )
    }

    default: {
      return <props.DefaultBodyComponent {...props} />
    }
  }
})
