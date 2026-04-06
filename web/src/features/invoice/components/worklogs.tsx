import { Badge, Checkbox, Flex } from '@radix-ui/themes'
import { useMemo } from 'react'

import type { TableProps } from '@/features/shared'

import { Table, worklogsMock, Text } from '@/features/shared'

export const Worklogs = () => {
  const tableConfig = useMemo(
    (): TableProps<(typeof worklogsMock)[number]>['config'] => [
      {
        dataKey: 'date',
        getHeaderContent: () => (
          <Flex align={'center'} gap={'2'}>
            <Checkbox />
            <Text color={'gray'}>Date</Text>
          </Flex>
        ),
        getRowContent: ({ date, dateRange }) => (
          <Flex gap={'3'} align={'center'}>
            <Checkbox />
            <Flex direction={'column'}>
              <Text>{dateRange}</Text>
              <Text color={'gray'}>{date}</Text>
            </Flex>
          </Flex>
        ),
        width: '165px',
      },
      {
        dataKey: 'projectName',
        getHeaderContent: () => <Text color={'gray'}>Project name</Text>,
        width: '240px',
      },
      {
        dataKey: 'note',
        getHeaderContent: () => <Text color={'gray'}>Note</Text>,
        getRowContent: ({ note }) => <Text color={'gray'}>{note}</Text>,
        width: '240px',
      },
      {
        dataKey: 'timeActive',
        getHeaderContent: () => <Text color={'gray'}>Time active</Text>,
        getRowContent: ({ timeActive }) => (
          <Flex justify={'center'}>
            <Badge>{timeActive}</Badge>
          </Flex>
        ),
        width: '130px',
      },
      {
        dataKey: 'keyboard',
        getHeaderContent: () => <Text color={'gray'}>Keyboard</Text>,
        width: '118px',
      },
      {
        dataKey: 'mouse',
        getHeaderContent: () => <Text color="gray">Mouse</Text>,
        width: '1fr',
      },
      {
        dataKey: 'mouseDistance',
        getHeaderContent: () => <Text color={'gray'}>Mouse distance</Text>,
        width: '155px',
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
      />
    </>
  )
}
