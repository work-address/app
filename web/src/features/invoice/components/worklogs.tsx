import { Badge, Checkbox, Flex } from '@radix-ui/themes'
import { memo, useMemo } from 'react'

import type { CellRenderProps, TableProps } from '@/features/shared'

import { Table, worklogsMock, Text } from '@/features/shared'

type WorklogRow = (typeof worklogsMock)[number]

export const Worklogs = () => {
  const tableConfig = useMemo(
    (): TableProps<WorklogRow>['config'] => [
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
        getRowKey={(row) => row.key}
        verticalAlign={'center'}
        BodyCellComponent={Cell}
        allowSelection
      />
    </>
  )
}

const Cell = memo(({ columnConfig, data }: CellRenderProps<WorklogRow>) => {
  switch (columnConfig.dataKey) {
    case 'date': {
      return (
        <Flex gap={'3'} align={'center'}>
          <Checkbox />

          <Flex direction={'column'}>
            <Text>{data.dateRange}</Text>
            <Text color={'gray'}>{data.date}</Text>
          </Flex>
        </Flex>
      )
    }

    case 'timeActive': {
      return (
        <Flex justify={'center'}>
          <Badge>{data.timeActive}</Badge>
        </Flex>
      )
    }

    default: {
      return <Text color={'gray'}>{data[columnConfig.dataKey]}</Text>
    }
  }
})
