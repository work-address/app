import { TrashIcon, PlusIcon } from '@radix-ui/react-icons'
import { Flex } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
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
import { MobileBody } from './mobile-body.tsx'
import { MobileHeader } from './mobile-header.tsx'
import { ProjectDialog } from './project-dialog.tsx'

import {
  $filteredActivities,
  $activitiesLoading,
  $activityStateFilter,
  $isActivitiesFiltering,
  changeActivityStateFilter,
  type ProjectsFilter,
  type ProjectWithStats,
  deleteActivityMutation,
} from '@/entities/activities'
import { type MobileDataTableConfig, type DataTableConfig } from '@/shared'
import {
  DataTable,
  MobileDataTable,
  TabsRoot,
  TabsList,
  TabsTrigger,
  Button,
  IconButton,
  useBreakpoint,
  useConfirm,
  showToast,
} from '@/shared'

export type ProjectStatus = 'Active' | 'Paused' | 'Finished'

export const ProjectsTable = () => {
  const isMobile = useBreakpoint('isMobile')

  const {
    projects,
    isActivitiesLoading,
    isActivitiesFiltering,
    filter,
    isProjectDeleting,
    deleteStatus,
    changeActivityStateFilterEvent,
    deleteProjectEvent,
    resetDeleteMutationEvent,
  } = useUnit({
    projects: $filteredActivities,
    isActivitiesLoading: $activitiesLoading,
    isActivitiesFiltering: $isActivitiesFiltering,
    filter: $activityStateFilter,
    changeActivityStateFilterEvent: changeActivityStateFilter,
    isProjectDeleting: deleteActivityMutation.$pending,
    deleteProjectEvent: deleteActivityMutation.start,
    deleteStatus: deleteActivityMutation.$status,
    resetDeleteMutationEvent: deleteActivityMutation.reset,
  })

  const renderingData = isActivitiesLoading ? [] : projects

  const { confirm } = useConfirm()

  const { t } = useTranslation()

  const [selectedRow, setSelectedRow] = useState<ProjectWithStats | null>(null)
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({})
  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)

  const handleTabClick = (tab: string) => {
    changeActivityStateFilterEvent({
      projectState: tab as ProjectsFilter['projectState'],
      containsText: '',
    })
    setSelectedIds({})
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
                if (row.id) {
                  deleteProjectEvent(row.id)
                }
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
      [confirm, t, deleteProjectEvent],
    )

  const desktopConfig = useMemo(
    (): DataTableConfig<ProjectWithStats> => [
      {
        dataKey: 'title',
        width: 230,
        headerText: t('dashboard.projectsTable.head.projectName'),
      },
      {
        dataKey: 'earnings',
        width: 90,
        headerText: t('dashboard.projectsTable.head.earnings'),
        getValue: (data) => `${data.earnings} ${t('currency.usdt')}`,
      },
      {
        dataKey: 'state',
        width: 100,
        horizontalAlign: 'center',
        headerText: t('dashboard.projectsTable.head.status'),
      },
      {
        customKey: 'timeTotal',
        width: 120,
        headerText: t('dashboard.projectsTable.head.timeTotal'),
      },
      {
        customKey: 'timeActive',
        width: 120,
        headerText: t('dashboard.projectsTable.head.timeActive'),
      },
      {
        dataKey: 'keyboardKeys',
        width: 160,
        headerText: t('dashboard.projectsTable.head.keyboardKeys'),
      },
      {
        dataKey: 'mouseKeys',
        width: 160,
        headerText: t('dashboard.projectsTable.head.mouseKeys'),
      },
      {
        dataKey: 'mouseDistance',
        width: 160,
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
        headerText: t('dashboard.projectsTable.head.keyboardKeys'),
      },
      {
        dataKey: 'mouseKeys',
        headerText: t('dashboard.projectsTable.head.mouseKeys'),
      },
      {
        dataKey: 'mouseDistance',
        headerText: t('dashboard.projectsTable.head.mouseDistance'),
      },
    ],
    [t],
  )

  const projectsContextValues = useMemo(
    (): ProjectTableContextValues => ({
      handleActionClick,
      t,
    }),
    [handleActionClick, t],
  )

  const allowDeleteAll = useMemo(() => {
    const selected = Object.values(selectedIds)

    return (
      selected.length > 0 &&
      projects.length === selected.length &&
      selected.every(Boolean)
    )
  }, [selectedIds, projects])

  useEffect(() => {
    if (deleteStatus === 'done') {
      resetDeleteMutationEvent()
      setIsProjectDialogOpen(false)

      showToast('error', {
        message: t('dashboard.projectsTable.deletedMessage'),
        position: 'top-center',
      })
    }
  }, [t, deleteStatus, resetDeleteMutationEvent])

  return (
    <Flex direction={'column'} height={'100%'}>
      <Flex direction={'row'} justify={'between'} pb={'3'} align={'center'}>
        <TabsRoot value={filter.projectState} onValueChange={handleTabClick}>
          <TabsList>
            <TabsTrigger value={'All'}>
              {t('dashboard.page.tabs.all')}
            </TabsTrigger>

            <TabsTrigger value={'Active'}>
              {t('dashboard.page.tabs.active')}
            </TabsTrigger>

            <TabsTrigger value={'Inactive'}>
              {t('dashboard.page.tabs.inactive')}
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
            key={filter.projectState}
            style={{ height: '100%' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {projects.length === 0 && !isActivitiesLoading ? (
              <ProjectsNotFound />
            ) : (
              <ProjectsTableContext value={projectsContextValues}>
                {isMobile ? (
                  <MobileDataTable
                    data={renderingData}
                    getRowId={rowIdGetter}
                    config={mobileConfig}
                    BodyComponent={MobileBody}
                    AddonBottomComponent={MobileAddonBottom}
                    HeaderComponent={MobileHeader}
                    expandedId={projects[0]?.id}
                    allowSelection
                    selectedIds={selectedIds}
                    onSelectedIdsChange={setSelectedIds}
                    loading={isActivitiesLoading}
                  />
                ) : (
                  <DataTable
                    data={renderingData}
                    config={desktopConfig}
                    getRowId={rowIdGetter}
                    allowSelection
                    BodyComponent={DesktopCell}
                    height={'100%'}
                    selectedIds={selectedIds}
                    onSelectedIdsChange={setSelectedIds}
                    verticalAlign={'middle'}
                    nowrap
                    loading={isActivitiesLoading}
                    skeletonHeight="31px"
                    mockDataLength={4}
                    isFiltering={isProjectDeleting || isActivitiesFiltering}
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
