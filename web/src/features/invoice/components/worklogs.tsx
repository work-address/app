import { Badge, Flex } from '@radix-ui/themes'
import { memo, useMemo } from 'react'

import type {
  CellRenderProps,
  HeaderCellRenderProps,
  TableProps,
} from '@/features/shared'

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
        HeaderCellComponent={HeaderCell}
        allowSelection
      />
    </>
  )
}

const HeaderCell = memo((props: HeaderCellRenderProps<WorklogRow>) => {
  if (props.dataKey === 'timeActive') {
    return (
      <Flex justify={'center'} width={'100%'}>
        {props.headerText}
      </Flex>
    )
  }

  const { DefaultHeaderCellComponent } = props

  return <DefaultHeaderCellComponent {...props} />
})

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
        <Flex justify={'center'} width={'100%'}>
          <Badge>{props.data.timeActive}</Badge>
        </Flex>
      )
    }

    default: {
      const { DefaultBodyCellComponent } = props

      return <DefaultBodyCellComponent {...props} />
    }
  }
})
