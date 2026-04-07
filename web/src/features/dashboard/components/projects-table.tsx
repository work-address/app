import { Badge, Flex } from '@radix-ui/themes'
import React, { type ReactNode, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useMediaQuery } from 'styled-breakpoints/use-media-query'
import styled, { useTheme } from 'styled-components'

import type {
  DesktopBodyCellRenderProps,
  MobileDataTableConfig,
  DataTableConfig,
} from '@/features/shared'

import { DataTable, MobileDataTable } from '@/features/shared'
import { Text } from '@/features/shared'

export type ProjectStatus = 'Active' | 'Paused' | 'Finished'

export type ProjectRow = {
  key: string
  name: string
  earnings: string
  status: ProjectStatus
  timeTotal: string
  timeActive: string
  keyboard: string
  mouse: string
  mouseDistance: string
}

type ProjectsTableProps = {
  rows: ProjectRow[]
}

export const ProjectsTable = ({ rows }: ProjectsTableProps) => {
  const { breakpoints } = useTheme()
  const isMobile = useMediaQuery(breakpoints.down('md'))

  const desktopConfig = useMemo(
    (): DataTableConfig<ProjectRow> => [
      { dataKey: 'name' },
      { dataKey: 'earnings' },
      { dataKey: 'status' },
      { dataKey: 'timeTotal' },
      { dataKey: 'timeActive' },
      { dataKey: 'keyboard' },
      { dataKey: 'mouse' },
      { dataKey: 'mouseDistance' },
    ],
    [],
  )

  const mobileConfig = useMemo(
    (): MobileDataTableConfig<ProjectRow> => [
      {
        dataKey: 'name',
        isTitle: true,
      },
      { dataKey: 'timeTotal' },
      { dataKey: 'timeActive' },
      { dataKey: 'mouse' },
      { dataKey: 'mouseDistance' },
    ],
    [],
  )

  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({})

  return (
    <ProjectsTableWrapper>
      {isMobile ? (
        <MobileDataTable
          data={rows}
          getRowId={rowIdGetter}
          config={mobileConfig}
        />
      ) : (
        <DataTable
          data={rows}
          config={desktopConfig}
          getRowId={rowIdGetter}
          allowSelection
          BodyComponent={BodyCellComponent}
          minHeight={'100%'}
          selectedIds={selectedIds}
          onSelectedIdsChange={setSelectedIds}
          verticalAlign={'middle'}
        />
      )}
    </ProjectsTableWrapper>
  )
}

const rowIdGetter = (row: ProjectRow) => row.key

const BodyCellComponent = React.memo(
  (props: DesktopBodyCellRenderProps<ProjectRow>) => {
    let content: ReactNode | null

    switch (props.dataKey) {
      case 'name': {
        content = (
          <Text $themeVariant={'primary'}>
            <NavLink to={'/test'}>{props.data.name}</NavLink>
          </Text>
        )
        break
      }

      case 'status': {
        content = (
          <Badge color={props.data.status === 'Active' ? 'green' : 'gray'}>
            {props.data.status}
          </Badge>
        )
        break
      }

      default: {
        content = (
          <Text color={'gray'}>
            <props.DefaultBodyComponent {...props} />
          </Text>
        )
        break
      }
    }

    return (
      <Flex py={'1'} direction={'column'}>
        {content}
      </Flex>
    )
  },
)

const ProjectsTableWrapper = styled.div`
  height: 100%;
`
