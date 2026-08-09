import { TrashIcon, PlusIcon } from '@radix-ui/react-icons'
import { Flex } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { ProjectsCreateModal } from '../projects-create-modal'
import { ProjectsDialog } from '../projects-dialog/projects-dialog'
import { ProjectsMobileAddonBottom } from '../projects-mobile/projects-mobile-addon-bottom'
import { ProjectsMobileBody } from '../projects-mobile/projects-mobile-body'
import { ProjectsMobileHeader } from '../projects-mobile/projects-mobile-header'

import { ProjectsDesktopCell } from './projects-table-cell'
import {
  ProjectsTableContext,
  type ProjectsTableContextValues,
} from './projects-table-context'

import {
  $filteredProjects,
  $projectsLoading,
  $projectStateFilter,
  $isProjectsFiltering,
  changeProjectStateFilter,
  type ProjectsFilter,
  type ProjectWithStats,
  deleteProjectMutation,
} from '@/entities/projects'
import { DashboardProjectsNotFound } from '@/features/dashboard'
import {
  type MobileDataTableConfig,
  type DataTableConfig,
  BASE_CURRENCY,
  formatAmount,
} from '@/shared'
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
  useDateFormatter,
  showToast,
} from '@/shared'

export const ProjectsTable = () => {
  const isMobile = useBreakpoint('isMobile')

  const {
    projects,
    isProjectsLoading,
    isProjectsFiltering,
    filter,
    isProjectDeleting,
    deleteStatus,
    changeProjectStateFilterEvent,
    deleteProjectEvent,
    resetDeleteMutationEvent,
  } = useUnit({
    projects: $filteredProjects,
    isProjectsLoading: $projectsLoading,
    isProjectsFiltering: $isProjectsFiltering,
    filter: $projectStateFilter,
    changeProjectStateFilterEvent: changeProjectStateFilter,
    isProjectDeleting: deleteProjectMutation.$pending,
    deleteProjectEvent: deleteProjectMutation.start,
    deleteStatus: deleteProjectMutation.$status,
    resetDeleteMutationEvent: deleteProjectMutation.reset,
  })

  const renderingData = isProjectsLoading ? [] : projects

  const { confirm } = useConfirm()

  const { t } = useTranslation()
  const dateFormatter = useDateFormatter()

  const [selectedRow, setSelectedRow] = useState<ProjectWithStats | null>(null)
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({})
  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)

  const handleTabClick = (tab: string) => {
    changeProjectStateFilterEvent({
      projectState: tab as ProjectsFilter['projectState'],
      containsText: '',
    })
    setSelectedIds({})
  }

  const handleActionClick: ProjectsTableContextValues['handleActionClick'] =
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
        }
      },
      [confirm, t, deleteProjectEvent],
    )

  const desktopConfig = useMemo(
    (): DataTableConfig<ProjectWithStats> => [
      {
        dataKey: 'createdAt',
        width: 140,
        headerText: t('dashboard.projectsTable.drawer.meta.createdAt'),
        getValue: (data: ProjectWithStats) =>
          dateFormatter.format(new Date(data.createdAt ?? new Date())),
      },
      {
        dataKey: 'title',
        width: 200,
        headerText: t('dashboard.projectsTable.head.projectName'),
      },
      {
        dataKey: 'earnings',
        width: 120,
        headerText: t('dashboard.projectsTable.head.earnings'),
        getValue: (data) =>
          `${formatAmount(data.earnings)} ${BASE_CURRENCY.code}`,
      },
      {
        dataKey: 'state',
        width: 120,
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
      // {
      //   dataKey: 'keyboardKeys',
      //   width: 160,
      //   headerText: t('dashboard.projectsTable.head.keyboardKeys'),
      // },
      // {
      //   dataKey: 'mouseKeys',
      //   width: 160,
      //   headerText: t('dashboard.projectsTable.head.mouseKeys'),
      // },
      // {
      //   dataKey: 'mouseDistance',
      //   width: 160,
      //   headerText: t('dashboard.projectsTable.head.mouseDistance'),
      // },
    ],
    [t, dateFormatter],
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
    (): ProjectsTableContextValues => ({
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
                <Button
                  color="danger"
                  variant="outline"
                  iconLeft={<TrashIcon />}
                >
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
              iconLeft={<PlusIcon />}
              onClick={() => setIsCreateDialogOpen(true)}
            >
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
            {projects.length === 0 && !isProjectsLoading ? (
              <DashboardProjectsNotFound
                onCreateClick={() => setIsCreateDialogOpen(true)}
              />
            ) : (
              <ProjectsTableContext value={projectsContextValues}>
                {isMobile ? (
                  <MobileDataTable
                    data={renderingData}
                    getRowId={rowIdGetter}
                    config={mobileConfig}
                    BodyComponent={ProjectsMobileBody}
                    AddonBottomComponent={ProjectsMobileAddonBottom}
                    HeaderComponent={ProjectsMobileHeader}
                    expandedId={projects[0]?.id}
                    // allowSelection
                    selectedIds={selectedIds}
                    onSelectedIdsChange={setSelectedIds}
                    loading={isProjectsLoading}
                  />
                ) : (
                  <DataTable
                    data={renderingData}
                    config={desktopConfig}
                    getRowId={rowIdGetter}
                    // allowSelection
                    BodyComponent={ProjectsDesktopCell}
                    height={'100%'}
                    selectedIds={selectedIds}
                    onSelectedIdsChange={setSelectedIds}
                    verticalAlign={'middle'}
                    nowrap
                    loading={isProjectsLoading}
                    skeletonHeight="31px"
                    mockDataLength={4}
                    isFiltering={isProjectDeleting || isProjectsFiltering}
                    onRowClick={handleActionClick}
                  />
                )}
              </ProjectsTableContext>
            )}
          </motion.div>
        </AnimatePresence>
      </ProjectsTableWrapper>
      <ProjectsDialog
        open={isProjectDialogOpen}
        setOpen={setIsProjectDialogOpen}
        row={selectedRow}
        onDeleteClick={(row) => row && handleActionClick(row, 'Delete')}
      />
      <ProjectsCreateModal
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
