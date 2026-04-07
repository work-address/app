import { useMemo, useState } from 'react'
import { useMediaQuery } from 'styled-breakpoints/use-media-query'
import styled, { useTheme } from 'styled-components'

import { DesktopCell } from './desktop-cell.tsx'
import { MobileAddonBottom } from './mobile-addon-bottom.tsx'
import { MobileHeader } from './mobile-header.tsx'

import type { ProjectRow } from './types'

import {
  type MobileDataTableConfig,
  type DataTableConfig,
} from '@/features/shared'
import { DataTable, MobileDataTable } from '@/features/shared'

export type ProjectStatus = 'Active' | 'Paused' | 'Finished'

type ProjectsTableProps = {
  rows: ProjectRow[]
}

export const ProjectsTable = ({ rows }: ProjectsTableProps) => {
  const { breakpoints } = useTheme()
  const isMobile = useMediaQuery(breakpoints.down('md'))

  const desktopConfig = useMemo(
    (): DataTableConfig<ProjectRow> => [
      {
        dataKey: 'name',
        width: 187,
      },
      {
        dataKey: 'earnings',
        width: 160,
      },
      {
        dataKey: 'status',
        width: 100,
        horizontalAlign: 'center',
      },
      {
        dataKey: 'timeTotal',
        width: 180,
      },
      {
        dataKey: 'timeActive',
        width: 160,
      },
      {
        dataKey: 'keyboard',
        width: 160,
      },
      {
        dataKey: 'mouse',
        width: 160,
      },
      {
        dataKey: 'mouseDistance',
      },
    ],
    [],
  )

  const mobileConfig = useMemo(
    (): MobileDataTableConfig<ProjectRow> => [
      {
        dataKey: 'name',
        isTitle: true,
      },
      {
        dataKey: 'timeTotal',
        description: 'test',
      },
      {
        dataKey: 'timeActive',
        description: 'test',
      },
      {
        dataKey: 'keyboard',
        description: 'test',
      },
      {
        dataKey: 'mouse',
        description: 'test',
      },
      {
        dataKey: 'mouseDistance',
        description: 'test',
      },
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
          AddonBottomComponent={MobileAddonBottom}
          HeaderComponent={MobileHeader}
          initialExpandedId={rows[0].key}
          allowSelection
          selectedIds={selectedIds}
          onSelectedIdsChange={setSelectedIds}
        />
      ) : (
        <DataTable
          data={rows}
          config={desktopConfig}
          getRowId={rowIdGetter}
          allowSelection
          BodyComponent={DesktopCell}
          minHeight={'100%'}
          selectedIds={selectedIds}
          onSelectedIdsChange={setSelectedIds}
          verticalAlign={'middle'}
          nowrap
        />
      )}
    </ProjectsTableWrapper>
  )
}

const rowIdGetter = (row: ProjectRow) => row.key

const ProjectsTableWrapper = styled.div`
  height: 100%;
`
