import { Pencil1Icon } from '@radix-ui/react-icons'
import { Badge, Flex, IconButton } from '@radix-ui/themes'
import { memo, useMemo, useState } from 'react'
import styled from 'styled-components'

import {
  type CellRenderProps,
  type TableColumnConfig,
  Table,
  Text,
} from '@/features/shared'

type WorklogsTableProps = {
  rows: WorklogRow[]
}

export const WorklogsTable = ({ rows }: WorklogsTableProps) => {
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({})

  const config = useMemo(
    (): TableColumnConfig<WorklogRow> => [
      {
        dataKey: 'date',
        headerText: 'Date',
      },
      {
        dataKey: 'projectName',
        headerText: 'Project name',
      },
      {
        dataKey: 'note',
        headerText: 'Note',
      },
      {
        dataKey: 'timeActive',
        headerText: 'Time active',
        horizontalAlign: 'center',
      },
      {
        dataKey: 'paymentStatus',
        headerText: 'Payment status',
        horizontalAlign: 'center',
      },
      {
        dataKey: 'keyboard',
        headerText: 'Keyboard',
      },
      {
        dataKey: 'mouse',
        headerText: 'Mouse',
      },
      {
        dataKey: 'mouseDistance',
        headerText: 'Mouse distance',
        width: 140,
      },
      {
        dataKey: 'screenshot',
        headerText: 'Screenshot',
        width: 114,
        horizontalAlign: 'center',
      },
      {
        customKey: 'actions',
        width: 64,
      },
    ],
    [],
  )

  return (
    <Table
      nowrap
      data={rows}
      config={config}
      getRowId={(row) => row.key}
      BodyCellComponent={BodyCellComponent}
      allowSelection
      selectedIds={selectedIds}
      onSelectedIdsChange={setSelectedIds}
    />
  )
}

const BodyCellComponent = memo((props: CellRenderProps<WorklogRow>) => {
  switch (props.dataKey) {
    case 'date': {
      return (
        <Flex direction={'column'}>
          <Text>{props.data.dateRange}</Text>
          <Text color={'gray'}>{props.data.date}</Text>
        </Flex>
      )
    }

    case 'note': {
      return <Text color={'gray'}>{props.data.note}</Text>
    }

    case 'timeActive': {
      return (
        <Badge color={Number(props.data.key) % 3 === 0 ? 'red' : 'green'}>
          {props.data.timeActive}
        </Badge>
      )
    }

    case 'paymentStatus': {
      return (
        <Badge color={props.data.paymentStatus === 'Paid' ? 'green' : 'red'}>
          {props.data.paymentStatus}
        </Badge>
      )
    }

    case 'screenshot': {
      return props.data.screenshot ? (
        <Screenshot src={props.data.screenshot} alt={props.data.projectName} />
      ) : (
        <Screenshot src={'/img/photo/example-screenshot.png'} alt={'No data'} />
      )
    }

    default: {
      if (props.customKey === 'actions') {
        return (
          <Flex>
            <IconButton variant={'ghost'} radius={'full'} color={'gray'}>
              <Pencil1Icon />
            </IconButton>
          </Flex>
        )
      }

      const { DefaultBodyCellComponent } = props
      return <DefaultBodyCellComponent {...props} />
    }
  }
})

export type PaymentStatus = 'Paid' | 'Unpaid'

export type WorklogRow = {
  key: string
  dateRange: string
  date: string
  projectName: string
  note: string
  timeActive: string
  paymentStatus: PaymentStatus
  keyboard: string
  mouse: string
  mouseDistance: string
  screenshot?: string
}

const Screenshot = styled.img`
  max-width: 64px;
`
