import { Badge, Checkbox, Flex } from '@radix-ui/themes'
import { useCallback, useMemo, useState } from 'react'

import type { TableProps } from '@/features/shared'

import { Table, worklogsMock, Text } from '@/features/shared'

type WorklogRow = (typeof worklogsMock)[number]

export const Worklogs = () => {
  const [selectedKeys, setSelectedKeys] = useState<Record<string, boolean>>({})

  const checkedCount = useMemo(
    () => Object.values(selectedKeys).filter(Boolean).length,
    [selectedKeys],
  )

  const isAllChecked = checkedCount === worklogsMock.length

  const handleToggleAll = useCallback(() => {
    setSelectedKeys(() =>
      checkedCount === 0
        ? Object.values(worklogsMock)
            .map(({ key }) => key)
            .reduce(
              (acc, curr) => {
                acc[curr] = true
                return acc
              },
              {} as Record<string, boolean>,
            )
        : Object.values(worklogsMock)
            .map(({ key }) => key)
            .reduce(
              (acc, curr) => {
                acc[curr] = false
                return acc
              },
              {} as Record<string, boolean>,
            ),
    )
  }, [checkedCount])

  const handleToggleKey = useCallback((key: string) => {
    setSelectedKeys((selectedKeys) => ({
      ...selectedKeys,
      [key]: !selectedKeys[key],
    }))
  }, [])

  const tableConfig = useMemo(
    (): TableProps<WorklogRow>['config'] => [
      {
        dataKey: 'date',
        getHeaderContent: () => (
          <Flex align={'center'} gap={'3'}>
            <Checkbox
              onCheckedChange={() => handleToggleAll()}
              checked={
                isAllChecked ? true : checkedCount > 0 ? 'indeterminate' : false
              }
            />
            <Text color={'gray'}>Date</Text>
          </Flex>
        ),
        getRowContent: ({ date, dateRange, key }) => (
          <Flex gap={'3'} align={'center'}>
            <Checkbox
              checked={selectedKeys[key]}
              onCheckedChange={() => handleToggleKey(key)}
            />

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
    [
      checkedCount,
      isAllChecked,
      handleToggleAll,
      handleToggleKey,
      selectedKeys,
    ],
  )

  return (
    <>
      <Text size={'5'}>Worklogs</Text>

      <Table
        data={worklogsMock}
        config={tableConfig}
        getRowKey={(row) => row.key}
        verticalAlign={'center'}
      />
    </>
  )
}
