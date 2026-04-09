import { TrashIcon, PlusIcon } from '@radix-ui/react-icons'
import { Flex, Grid } from '@radix-ui/themes'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { ProjectsNotFound } from '../projects-not-found.tsx'

import {
  ProjectsTableContext,
  type ProjectTableContextValues,
} from './context.ts'
import { DesktopCell } from './desktop-cell.tsx'
import { MobileAddonBottom } from './mobile-addon-bottom.tsx'
import { MobileHeader } from './mobile-header.tsx'
import { ProjectDialogContent } from './project-dialog-content.tsx'

import type { ProjectRow } from './types'

import {
  type MobileDataTableConfig,
  type DataTableConfig,
  useBreakpoints,
} from '@/features/shared'
import {
  DataTable,
  MobileDataTable,
  useDataProcessing,
  Text,
  projectsMock,
  TabsRoot,
  TabsList,
  TabsTrigger,
  Button,
  IconButton,
  AdaptiveDialog,
} from '@/features/shared'

export type ProjectStatus = 'Active' | 'Paused' | 'Finished'

type ProjectsTableProps = {
  rows?: ProjectRow[]
}

export const ProjectsTable = ({ rows = projectsMock }: ProjectsTableProps) => {
  const { isDesktop, isMobile } = useBreakpoints()
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState('all')
  const [selectedRow, setSelectedRow] = useState<ProjectRow | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const { processedData, processSingleDataFilter, resetFilter } =
    useDataProcessing({
      data: rows,
    })

  const handleTabClick = (tab: string) => {
    setActiveTab(tab)
    setSelectedIds({})

    switch (tab) {
      case 'all': {
        return resetFilter()
      }
      case 'active': {
        return processSingleDataFilter('status', 'Active', 'equals')
      }
      case 'finished': {
        return processSingleDataFilter('status', 'Finished', 'equals')
      }
    }
  }

  const handleActionClick: ProjectTableContextValues['handleActionClick'] =
    useCallback((row, action) => {
      switch (action) {
        case 'Edit': {
          setSelectedRow(row)
          setIsDialogOpen(true)
          break
        }

        case 'Delete':
        case 'Print': {
          alert(`${row.key} ${action}`)
          break
        }
      }
    }, [])

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
      {
        customKey: 'actions',
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

  const allowDeleteAll = useMemo(() => {
    const selected = Object.values(selectedIds)

    return (
      selected.length > 0 &&
      processedData.length === selected.length &&
      selected.every(Boolean)
    )
  }, [selectedIds, processedData])

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
          {allowDeleteAll && (
            <>
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
            </>
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
        <AnimatePresence mode={'wait'}>
          <motion.div
            key={activeTab}
            style={{ height: '100%' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {processedData.length === 0 ? (
              <ProjectsNotFound
                title={t('dashboard.page.projectsNotFound.title')}
                description={t('dashboard.page.projectsNotFound.description')}
                actionLabel={t('dashboard.page.createProject')}
              />
            ) : (
              <ProjectsTableContext value={{ handleActionClick }}>
                {isMobile ? (
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
              </ProjectsTableContext>
            )}
          </motion.div>
        </AnimatePresence>
      </ProjectsTableWrapper>

      <AdaptiveDialog
        title={
          isDesktop ? (
            <span>{selectedRow?.name}</span>
          ) : (
            <Flex justify={'between'} align={'center'}>
              <Text>{selectedRow?.name}</Text>

              <IconButton color={'red'} variant={'outline'}>
                <TrashIcon />
              </IconButton>
            </Flex>
          )
        }
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        desktopWidth={'600px'}
        description={
          isDesktop ? (
            <Flex justify={'between'}>
              <Button color={'red'} variant={'outline'}>
                <TrashIcon /> Delete
              </Button>

              <Flex gap={'3'}>
                <Button
                  themeVariant={'secondary'}
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button themeVariant={'primary'}> Save </Button>
              </Flex>
            </Flex>
          ) : (
            <Grid columns={'1fr 1fr'} gap={'2'}>
              <Button themeVariant={'secondary'} variant={'outline'}>
                Invoice
              </Button>

              <Button themeVariant={'primary'}>Edit</Button>
            </Grid>
          )
        }
      >
        {selectedRow && <ProjectDialogContent data={selectedRow} />}
      </AdaptiveDialog>
    </Flex>
  )
}

const rowIdGetter = (row: ProjectRow) => row.key

const ProjectsTableWrapper = styled.div`
  height: 100%;
`

export { type ProjectRow } from './types'
