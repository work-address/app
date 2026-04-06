import { Badge, type BadgeProps, Flex } from '@radix-ui/themes'
import { memo, useMemo, useState } from 'react'

import type { CellRenderProps, TableColumnConfig } from '@/features/shared'

import { Table, worklogsMock, Text } from '@/features/shared'

type WorklogRow = (typeof worklogsMock)[number]

export const Worklogs = () => {
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({})

  const tableConfig = useMemo(
    (): TableColumnConfig<WorklogRow> => [
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

      <Table
        data={worklogsMock}
        config={tableConfig}
        getRowId={(row) => row.key}
        verticalAlign={'middle'}
        BodyCellComponent={Cell}
        allowSelection
        selectedIds={selectedIds}
        onSelectedIdsChange={setSelectedIds}
        nowrap
      />
    </>
  )
}

const BadgeTestColor: BadgeProps['color'][] = [
  'gray',
  'blue',
  'amber',
  'bronze',
  'brown',
  'crimson',
  'cyan',
  'gold',
]

const Cell = memo((props: CellRenderProps<WorklogRow>) => {
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
            BadgeTestColor[Math.floor(Math.random() * BadgeTestColor.length)]
          }
        >
          {props.data.timeActive}
        </Badge>
      )
    }

    default: {
      const { DefaultBodyCellComponent } = props
      return <DefaultBodyCellComponent {...props} />
    }
  }
})
