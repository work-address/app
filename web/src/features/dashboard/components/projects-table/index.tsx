import {
  TrashIcon,
  PlusIcon,
  DownloadIcon,
  Pencil1Icon,
} from '@radix-ui/react-icons'
import { Flex, Grid } from '@radix-ui/themes'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { ProjectsNotFound } from '../projects-not-found'

import {
  ProjectsTableContext,
  type ProjectTableContextValues,
} from './context.ts'
import { CreateProjectModal } from './create-project-modal.tsx'
import { DesktopCell } from './desktop-cell.tsx'
import { MobileAddonBottom } from './mobile-addon-bottom.tsx'
import { MobileHeader } from './mobile-header.tsx'
import { ProjectDialogContent } from './project-dialog-content.tsx'
import { ProjectMobileBody } from './project-mobile-body.tsx'

import type { ProjectRow } from './types'

import {
  type MobileDataTableConfig,
  type DataTableConfig,
  useBreakpoints,
  useConfirm,
} from '@/features/shared'
import {
  DataTable,
  MobileDataTable,
  useDataProcessing,
  Text,
  TabsRoot,
  TabsList,
  TabsTrigger,
  Button,
  IconButton,
  AdaptiveDialog,
} from '@/features/shared'

export type ProjectStatus = 'Active' | 'Paused' | 'Finished'

type ProjectsTableProps = {
  rows: ProjectRow[]
}

export const ProjectsTable = ({ rows }: ProjectsTableProps) => {
  const { isDesktop, isMobile } = useBreakpoints()
  const { confirm } = useConfirm()

  const { t } = useTranslation()

  const [activeTab, setActiveTab] = useState('all')
  const [selectedRow, setSelectedRow] = useState<ProjectRow | null>(null)
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({})
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'view' | 'edit'>('view')

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
    useCallback(
      (row, action) => {
        switch (action) {
          case 'Edit': {
            setSelectedRow(row)
            setIsEditDialogOpen(true)
            break
          }

          case 'Delete': {
            void confirm({
              title: t('dashboard.projectsTable.confirmDelete.title'),
              description: t(
                'dashboard.projectsTable.confirmDelete.description',
              ),
              confirmLabel: t('dashboard.projectsTable.confirmDelete.confirm'),
              onConfirm: () => {
                setIsEditDialogOpen(false)
              },
            })
            break
          }

          case 'Print': {
            alert(`${row.key} ${action}`)
            break
          }
        }
      },
      [confirm, t],
    )

  const desktopConfig = useMemo(
    (): DataTableConfig<ProjectRow> => [
      {
        dataKey: 'name',
        width: 187,
        headerText: t('dashboard.projectsTable.head.projectName'),
      },
      {
        dataKey: 'earnings',
        width: 160,
        headerText: t('dashboard.projectsTable.head.earnings'),
      },
      {
        dataKey: 'status',
        width: 100,
        horizontalAlign: 'center',
        headerText: t('dashboard.projectsTable.head.status'),
      },
      {
        dataKey: 'timeTotal',
        width: 180,
        headerText: t('dashboard.projectsTable.head.timeTotal'),
      },
      {
        dataKey: 'timeActive',
        width: 160,
        headerText: t('dashboard.projectsTable.head.timeActive'),
      },
      {
        dataKey: 'keyboard',
        width: 160,
        headerText: t('dashboard.projectsTable.head.keyboard'),
      },
      {
        dataKey: 'mouse',
        width: 160,
        headerText: t('dashboard.projectsTable.head.mouse'),
      },
      {
        dataKey: 'mouseDistance',
        headerText: t('dashboard.projectsTable.head.mouseDistance'),
      },
      {
        customKey: 'actions',
        headerText: '',
      },
    ],
    [t],
  )

  const mobileConfig = useMemo(
    (): MobileDataTableConfig<ProjectRow> => [
      {
        dataKey: 'name',
        isTitle: true,
      },
      {
        dataKey: 'timeTotal',
        headerText: t('dashboard.projectsTable.head.timeTotal'),
      },
      {
        dataKey: 'timeActive',
        headerText: t('dashboard.projectsTable.head.timeActive'),
      },
      {
        dataKey: 'keyboard',
        headerText: t('dashboard.projectsTable.head.keyboard'),
      },
      {
        dataKey: 'mouse',
        headerText: t('dashboard.projectsTable.head.mouse'),
      },
      {
        dataKey: 'mouseDistance',
        headerText: t('dashboard.projectsTable.head.mouseDistance'),
      },
    ],
    [t],
  )

  const allowDeleteAll = useMemo(() => {
    const selected = Object.values(selectedIds)

    return (
      selected.length > 0 &&
      processedData.length === selected.length &&
      selected.every(Boolean)
    )
  }, [selectedIds, processedData])

  useEffect(() => {
    if (isEditDialogOpen) {
      setModalMode('view')
    }
  }, [isEditDialogOpen])

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
            <IconButton
              themeVariant={'primary'}
              onClick={() => setIsCreateDialogOpen(true)}
            >
              <PlusIcon />
            </IconButton>
          ) : (
            <Button
              themeVariant={'primary'}
              onClick={() => setIsCreateDialogOpen(true)}
            >
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
              <ProjectsNotFound />
            ) : (
              <ProjectsTableContext value={{ handleActionClick }}>
                {isMobile ? (
                  <MobileDataTable
                    data={processedData}
                    getRowId={rowIdGetter}
                    config={mobileConfig}
                    BodyComponent={ProjectMobileBody}
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
            selectedRow?.name
          ) : (
            <Flex justify={'between'} align={'center'}>
              <Text>{selectedRow?.name}</Text>

              <IconButton
                color={'red'}
                variant={'outline'}
                onClick={() =>
                  selectedRow && handleActionClick(selectedRow, 'Delete')
                }
              >
                <TrashIcon />
              </IconButton>
            </Flex>
          )
        }
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        desktopWidth={'600px'}
        description={
          isDesktop ? (
            <Flex justify={'between'}>
              <Button color={'red'} variant={'outline'} size={'3'}>
                <TrashIcon />
                Delete
              </Button>

              <Flex gap={'3'}>
                {modalMode === 'view' ? (
                  <>
                    <Button
                      themeVariant={'secondary'}
                      variant={'outline'}
                      size={'3'}
                    >
                      <DownloadIcon />
                      Invoice
                    </Button>

                    <Button
                      themeVariant={'primary'}
                      size={'3'}
                      onClick={() => setModalMode('edit')}
                    >
                      <Pencil1Icon />
                      Edit
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      themeVariant={'secondary'}
                      onClick={() => setModalMode('view')}
                      size={'3'}
                    >
                      Cancel
                    </Button>

                    <Button themeVariant={'primary'} size={'3'}>
                      Save
                    </Button>
                  </>
                )}
              </Flex>
            </Flex>
          ) : (
            <Grid columns={'1fr 1fr'} gap={'2'}>
              <>
                {modalMode === 'view' ? (
                  <>
                    <Button themeVariant={'secondary'} variant={'outline'}>
                      <DownloadIcon />
                      Invoice
                    </Button>

                    <Button
                      themeVariant={'primary'}
                      onClick={() => setModalMode('edit')}
                    >
                      <Pencil1Icon />
                      Edit
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      themeVariant={'secondary'}
                      onClick={() => setModalMode('view')}
                    >
                      Cancel
                    </Button>

                    <Button themeVariant={'primary'}>Save</Button>
                  </>
                )}
              </>
            </Grid>
          )
        }
      >
        {selectedRow && (
          <ProjectDialogContent data={selectedRow} mode={modalMode} />
        )}
      </AdaptiveDialog>

      <CreateProjectModal
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      />
    </Flex>
  )
}

const rowIdGetter = (row: ProjectRow) => row.key

const ProjectsTableWrapper = styled.div`
  height: 100%;
`

export { type ProjectRow } from './types'
