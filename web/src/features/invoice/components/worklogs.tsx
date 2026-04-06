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
        width: '165px',
        headerText: 'Date',
      },
      {
        dataKey: 'projectName',
        width: '240px',
        headerText: 'Project name',
      },
      {
        dataKey: 'note',
        width: '240px',
        headerText: 'Note',
      },
      {
        dataKey: 'timeActive',
        width: '130px',
        headerText: 'Time active',
        horizontalAlign: 'center',
      },
      {
        dataKey: 'keyboard',
        width: '118px',
        headerText: 'Keyboard',
      },
      {
        dataKey: 'mouse',
        width: '1fr',
        headerText: 'Mouse',
      },
      {
        dataKey: 'mouseDistance',
        width: '155px',
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
        verticalAlign={'center'}
        BodyCellComponent={Cell}
        allowSelection
        selectedIds={selectedIds}
        onSelectedIdsChange={setSelectedIds}
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
  switch (props.columnConfig.dataKey) {
    case 'date': {
      return (
        <div>
          <Text>{props.data.dateRange}</Text>
          <Text color={'gray'}>{props.data.date}</Text>
        </div>
      )
    }

    case 'timeActive': {
      return (
        <Flex>
          <Badge
            color={
              BadgeTestColor[Math.floor(Math.random() * BadgeTestColor.length)]
            }
          >
            {props.data.timeActive}
          </Badge>
        </Flex>
      )
    }

    default: {
      const { DefaultBodyCellComponent } = props
      return <DefaultBodyCellComponent {...props} />
    }
  }
})
