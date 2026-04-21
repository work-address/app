import { TrashIcon, PlusIcon } from '@radix-ui/react-icons'
import { Flex } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useMemo, useState, useEffect } from 'react'
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
import { MobileBody } from './mobile-body.tsx'
import { MobileHeader } from './mobile-header.tsx'
import { ProjectDialog } from './project-dialog.tsx'

import {
  fetchActivities,
  $activities,
  $activitiesLoading,
  type ProjectWithStats,
} from '@/entities/activities'
import {
  type MobileDataTableConfig,
  type DataTableConfig,
  showToast,
} from '@/features/shared'
import {
  DataTable,
  MobileDataTable,
  useDataProcessing,
  TabsRoot,
  TabsList,
  TabsTrigger,
  Button,
  IconButton,
  useBreakpoint,
  useConfirm,
} from '@/features/shared'

export type ProjectStatus = 'Active' | 'Paused' | 'Finished'

export const ProjectsTable = () => {
  const isMobile = useBreakpoint('isMobile')

  const { fetchActivities: fetchActivitiesEvent, projects } = useUnit({
    fetchActivities: fetchActivities,
    projects: $activities,
    loading: $activitiesLoading,
  })

  const loading = true

  const { confirm } = useConfirm()

  const { t } = useTranslation()

  const [activeTab, setActiveTab] = useState('all')
  const [selectedRow, setSelectedRow] = useState<ProjectWithStats | null>(null)
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({})
  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)

  const { processedData, processSingleDataFilter, resetFilter } =
    useDataProcessing({
      data: projects,
    })

  const handleTabClick = (tab: string) => {
    setActiveTab(tab)
    setSelectedIds({})

    switch (tab) {
      case 'all': {
        return resetFilter()
      }
      case 'active': {
        return processSingleDataFilter('state', 'Active', 'equals')
      }
      case 'finished': {
        return processSingleDataFilter('state', 'Finished', 'equals')
      }
    }
  }

  const handleActionClick: ProjectTableContextValues['handleActionClick'] =
    useCallback(
      (row, action) => {
        switch (action) {
          case 'Edit': {
            setSelectedRow(row)
            setIsProjectDialogOpen(true)
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
                setIsProjectDialogOpen(false)

                showToast('error', {
                  message: t('dashboard.projectsTable.deletedMessage'),
                  position: 'top-center',
                })
              },
            })
            break
          }

          case 'Print': {
            alert(`${row.id} ${action}`)
            break
          }
        }
      },
      [confirm, t],
    )

  const desktopConfig = useMemo(
    (): DataTableConfig<ProjectWithStats> => [
      {
        dataKey: 'title',
        width: 187,
        headerText: t('dashboard.projectsTable.head.projectName'),
      },
      {
        dataKey: 'earnings',
        width: 160,
        headerText: t('dashboard.projectsTable.head.earnings'),
      },
      {
        dataKey: 'state',
        width: 100,
        horizontalAlign: 'center',
        headerText: t('dashboard.projectsTable.head.status'),
      },
      {
        customKey: 'timeTotal',
        width: 180,
        headerText: t('dashboard.projectsTable.head.timeTotal'),
      },
      {
        customKey: 'timeActive',
        width: 160,
        headerText: t('dashboard.projectsTable.head.timeActive'),
      },
      {
        dataKey: 'keyboardKeys',
        width: 160,
        headerText: t('dashboard.projectsTable.head.keyboard'),
      },
      {
        dataKey: 'mouseKeys',
        width: 160,
        headerText: t('dashboard.projectsTable.head.mouse'),
      },
      {
        dataKey: 'mouseDistance',
        headerText: t('dashboard.projectsTable.head.mouseDistance'),
      },
      {
        customKey: 'actions',
        headerText: 'Actions',
        sticky: 'right',
      },
    ],
    [t],
  )

  const mobileConfig = useMemo(
    (): MobileDataTableConfig<ProjectWithStats> => [
      {
        dataKey: 'title',
        isTitle: true,
      },
      {
        customKey: 'timeTotal',
        headerText: t('dashboard.projectsTable.head.timeTotal'),
      },
      {
        customKey: 'timeActive',
        headerText: t('dashboard.projectsTable.head.timeActive'),
      },
      {
        dataKey: 'keyboardKeys',
        headerText: t('dashboard.projectsTable.head.keyboard'),
      },
      {
        dataKey: 'mouseKeys',
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
    fetchActivitiesEvent()
  }, [fetchActivitiesEvent])

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
            {projects.length === 0 && !loading ? (
              <ProjectsNotFound />
            ) : (
              <ProjectsTableContext value={{ handleActionClick }}>
                {isMobile ? (
                  <MobileDataTable
                    data={projects}
                    getRowId={rowIdGetter}
                    config={mobileConfig}
                    BodyComponent={MobileBody}
                    AddonBottomComponent={MobileAddonBottom}
                    HeaderComponent={MobileHeader}
                    initialExpandedId={projects[0]?.id}
                    allowSelection
                    selectedIds={selectedIds}
                    onSelectedIdsChange={setSelectedIds}
                  />
                ) : (
                  <DataTable
                    data={projects}
                    config={desktopConfig}
                    getRowId={rowIdGetter}
                    allowSelection
                    BodyComponent={DesktopCell}
                    height={'100%'}
                    selectedIds={selectedIds}
                    onSelectedIdsChange={setSelectedIds}
                    verticalAlign={'middle'}
                    nowrap
                    loading={loading}
                  />
                )}
              </ProjectsTableContext>
            )}
          </motion.div>
        </AnimatePresence>
      </ProjectsTableWrapper>

      <ProjectDialog
        open={isProjectDialogOpen}
        setOpen={setIsProjectDialogOpen}
        row={selectedRow}
        onDeleteClick={(row) => row && handleActionClick(row, 'Delete')}
      />

      <CreateProjectModal
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      />
    </Flex>
  )
}

const rowIdGetter = (row: ProjectWithStats) => row.id ?? ''

const ProjectsTableWrapper = styled.div`
  height: 100%;

  ${(p) => p.theme.breakpoints.up('md')} {
    height: 307px;
    overflow: auto;
  }
`

export { type ProjectRow } from './types'
