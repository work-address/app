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
        <ImagePlaceholder />
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

const ImagePlaceholder = () => {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ color: 'rgba(0, 7, 20, 0.4)' }}
    >
      <path
        d="M4 5.5C4 4.67157 4.67157 4 5.5 4H18.5C19.3284 4 20 4.67157 20 5.5V18.5C20 19.3284 19.3284 20 18.5 20H5.5C4.67157 20 4 19.3284 4 18.5V5.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M8 14L10.5 11.5L14.5 15.5L16.5 13.5L20 17"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 9.25C9 9.94036 8.44036 10.5 7.75 10.5C7.05964 10.5 6.5 9.94036 6.5 9.25C6.5 8.55964 7.05964 8 7.75 8C8.44036 8 9 8.55964 9 9.25Z"
        fill="currentColor"
      />
    </svg>
  )
}

const Screenshot = styled.img`
  max-width: 64px;
`
