import { TrashIcon, PlusIcon } from '@radix-ui/react-icons'
import { Flex } from '@radix-ui/themes'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMediaQuery } from 'styled-breakpoints/use-media-query'
import styled, { useTheme } from 'styled-components'

import { DesktopCell } from './desktop-cell.tsx'
import { MobileAddonBottom } from './mobile-addon-bottom.tsx'
import { MobileHeader } from './mobile-header.tsx'

import type { ProjectRow } from './types'

import { ProjectsNotFound } from '@/features/dashboard'
import {
  type MobileDataTableConfig,
  type DataTableConfig,
  projectsMock,
  TabsRoot,
  TabsList,
  TabsTrigger,
  Button,
  IconButton,
} from '@/features/shared'
import {
  DataTable,
  MobileDataTable,
  useDataProcessing,
} from '@/features/shared'

export type ProjectStatus = 'Active' | 'Paused' | 'Finished'

type ProjectsTableProps = {
  rows?: ProjectRow[]
}

export const ProjectsTable = ({ rows = projectsMock }: ProjectsTableProps) => {
  const { breakpoints } = useTheme()
  const isMobile = useMediaQuery(breakpoints.down('md'))
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState('all')

  const { processedData, processDataFilter, resetFilter } = useDataProcessing({
    data: rows,
  })

  const handleTabClick = (tab: string) => {
    setActiveTab(tab)

    switch (tab) {
      case 'all': {
        return resetFilter()
      }
      case 'active': {
        return processDataFilter('status', 'Active', 'equals')
      }
      case 'finished': {
        return processDataFilter('status', 'Finished', 'equals')
      }
    }
  }

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
    <Flex direction={'column'} height={'100%'}>
      <Flex direction={'row'} justify={'between'} pb={'3'} align={'center'}>
        <TabsRoot value={activeTab} onValueChange={handleTabClick}>
          <TabsList>
            <TabsTrigger value={'all'}>
              {t('dashboard.page.tabs.all')}
            </TabsTrigger>
            <TabsTrigger value={'active'}>
              {t('dashboard.page.tabs.active')}
            </TabsTrigger>
            <TabsTrigger value={'finished'}>
              {t('dashboard.page.tabs.finished')}
            </TabsTrigger>
          </TabsList>
        </TabsRoot>

        <Flex gap={'var(--space-2)'}>
          {isMobile ? (
            <IconButton variant={'outline'} color={'red'}>
              <TrashIcon />
            </IconButton>
          ) : (
            <Button variant={'outline'} color={'red'}>
              <TrashIcon />
              {t('dashboard.page.deleteAll')}
            </Button>
          )}

          {isMobile ? (
            <IconButton themeVariant={'primary'}>
              <PlusIcon />
            </IconButton>
          ) : (
            <Button themeVariant={'primary'}>
              <PlusIcon />
              {t('dashboard.page.createProject')}
            </Button>
          )}
        </Flex>
      </Flex>

      <ProjectsTableWrapper>
        {processedData.length === 0 ? (
          <ProjectsNotFound
            title={t('dashboard.page.projectsNotFound.title')}
            description={t('dashboard.page.projectsNotFound.description')}
            actionLabel={t('dashboard.page.createProject')}
          />
        ) : isMobile ? (
          <MobileDataTable
            data={processedData}
            getRowId={rowIdGetter}
            config={mobileConfig}
            AddonBottomComponent={MobileAddonBottom}
            HeaderComponent={MobileHeader}
            initialExpandedId={rows[0]?.key}
            allowSelection
            selectedIds={selectedIds}
            onSelectedIdsChange={setSelectedIds}
          />
        ) : (
          <DataTable
            data={processedData}
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
    </Flex>
  )
}

const rowIdGetter = (row: ProjectRow) => row.key

const ProjectsTableWrapper = styled.div`
  height: 100%;
`

export { type ProjectRow } from './types'
