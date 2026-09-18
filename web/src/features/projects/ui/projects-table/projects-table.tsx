import { TrashIcon, PlusIcon } from '@radix-ui/react-icons'
import { Flex } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import {
  $canDeleteAllProjects,
  $isProjectCreateDialogOpen,
  $isProjectDialogOpen,
  $projectSelection,
  $selectedProject,
  $viewerOnlyProjectIds,
  projectCreateDialogOpenChanged,
  projectDeleteRequested,
  projectDialogOpenChanged,
  projectEditRequested,
  projectSelectionChanged,
  projectStateTabChanged,
} from '../../model'
import { ProjectsCreateModal } from '../projects-create-modal'
import { ProjectsDialog } from '../projects-dialog/projects-dialog'
import {
  ProjectsMobileAddonBottom,
  ProjectsMobileBody,
  ProjectsMobileHeader,
} from '../projects-mobile'

import {
  ProjectsTableContext,
  type ProjectsTableContextValues,
} from './projects-table-context'
import { ProjectsDesktopCell } from './projects-table-desktop-cell'

import {
  $filteredProjects,
  $projectsLoading,
  $projectStateFilter,
  $isProjectsFiltering,
  type ProjectsFilter,
  type ProjectWithStats,
  deleteProjectMutation,
} from '@/entities/projects'
import {
  type MobileDataTableConfig,
  type DataTableConfig,
  formatCount,
  formatCurrency,
} from '@/shared'
import {
  DataTable,
  MobileDataTable,
  TabsRoot,
  TabsList,
  TabsTrigger,
  Button,
  IconButton,
  Tooltip,
  useBreakpoint,
  useDateFormatter,
  ProjectsEmptyState,
} from '@/shared'

const rowIdGetter = (row: ProjectWithStats) => row.id ?? ''

export const ProjectsTable = () => {
  const isMobile = useBreakpoint('isMobile')

  const {
    projects,
    isProjectsLoading,
    isProjectsFiltering,
    filter,
    isProjectDeleting,
    changeStateTab,
    selection,
    changeSelection,
    selectedRow,
    requestEdit,
    requestDelete,
    isProjectDialogOpen,
    setProjectDialogOpen,
    isCreateDialogOpen,
    setCreateDialogOpen,
    allowDeleteAll,
    viewerOnlyProjectIds,
  } = useUnit({
    projects: $filteredProjects,
    isProjectsLoading: $projectsLoading,
    isProjectsFiltering: $isProjectsFiltering,
    filter: $projectStateFilter,
    isProjectDeleting: deleteProjectMutation.$pending,
    changeStateTab: projectStateTabChanged,
    selection: $projectSelection,
    changeSelection: projectSelectionChanged,
    selectedRow: $selectedProject,
    requestEdit: projectEditRequested,
    requestDelete: projectDeleteRequested,
    isProjectDialogOpen: $isProjectDialogOpen,
    setProjectDialogOpen: projectDialogOpenChanged,
    isCreateDialogOpen: $isProjectCreateDialogOpen,
    setCreateDialogOpen: projectCreateDialogOpenChanged,
    allowDeleteAll: $canDeleteAllProjects,
    viewerOnlyProjectIds: $viewerOnlyProjectIds,
  })

  const renderingData = isProjectsLoading ? [] : projects

  const { t } = useTranslation()
  const dateFormatter = useDateFormatter()

  const handleTabClick = (tab: string) => {
    changeStateTab(tab as ProjectsFilter['projectState'])
  }

  const handleActionClick: ProjectsTableContextValues['handleActionClick'] =
    useCallback(
      (row, action) => {
        switch (action) {
          case 'Edit': {
            requestEdit(row)
            break
          }

          case 'Delete': {
            requestDelete(row)
            break
          }
        }
      },
      [requestEdit, requestDelete],
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
        dataKey: 'state',
        width: 120,
        horizontalAlign: 'center',
        headerText: t('dashboard.projectsTable.head.status'),
      },
      {
        // `mapProjectsAndStats` prefers the project's own rate over the totals
        // row, so a project with nothing tracked yet still shows its rate
        // rather than $0.00.
        dataKey: 'rateHour',
        width: 120,
        headerText: t('dashboard.projectsTable.drawer.meta.rateHour'),
        description: t('common.metricDesc.rateHour'),
        getValue: (data) => formatCurrency(data.rateHour),
      },
      {
        customKey: 'timeTotal',
        width: 120,
        headerText: t('dashboard.projectsTable.head.timeTotal'),
        description: t('common.metricDesc.timeTotal'),
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
        description: t('common.metricDesc.timeTotal'),
      },
      {
        customKey: 'timeActive',
        headerText: t('dashboard.projectsTable.head.timeActive'),
        description: t('common.metricDesc.timeActive'),
      },
      {
        dataKey: 'keyboardKeys',
        headerText: t('dashboard.projectsTable.head.keyboardKeys'),
        description: t('common.metricDesc.keyboard'),
        getValue: (data) => formatCount(data.keyboardKeys),
      },
      {
        dataKey: 'mouseKeys',
        headerText: t('dashboard.projectsTable.head.mouseKeys'),
        description: t('common.metricDesc.mouse'),
        getValue: (data) => formatCount(data.mouseKeys),
      },
      {
        dataKey: 'mouseDistance',
        headerText: t('dashboard.projectsTable.head.mouseDistance'),
        description: t('common.metricDesc.mouseDistance'),
        getValue: (data) => formatCount(data.mouseDistance),
      },
    ],
    [t],
  )

  const canInvoice: ProjectsTableContextValues['canInvoice'] = useCallback(
    (row) => !viewerOnlyProjectIds.includes(row.id ?? ''),
    [viewerOnlyProjectIds],
  )

  const projectsContextValues = useMemo(
    (): ProjectsTableContextValues => ({
      handleActionClick,
      canInvoice,
      t,
    }),
    [handleActionClick, canInvoice, t],
  )

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
                <Tooltip content={t('dashboard.page.deleteAll')}>
                  <IconButton
                    variant={'outline'}
                    color={'red'}
                    aria-label={t('dashboard.page.deleteAll')}
                  >
                    <TrashIcon />
                  </IconButton>
                </Tooltip>
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
            <Tooltip content={t('dashboard.page.createProject')}>
              <IconButton
                themeVariant={'primary'}
                onClick={() => setCreateDialogOpen(true)}
                aria-label={t('dashboard.page.createProject')}
              >
                <PlusIcon />
              </IconButton>
            </Tooltip>
          ) : (
            <Button
              iconLeft={<PlusIcon />}
              onClick={() => setCreateDialogOpen(true)}
            >
              {t('dashboard.page.createProject')}
            </Button>
          )}
        </Flex>
      </Flex>
      <Root>
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
              <ProjectsEmptyState
                onCreateClick={() => setCreateDialogOpen(true)}
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
                    selectedIds={selection}
                    onSelectedIdsChange={changeSelection}
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
                    selectedIds={selection}
                    onSelectedIdsChange={changeSelection}
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
      </Root>
      <ProjectsDialog
        open={isProjectDialogOpen}
        setOpen={setProjectDialogOpen}
        row={selectedRow}
        onDeleteClick={(row) => row && handleActionClick(row, 'Delete')}
      />
      <ProjectsCreateModal
        open={isCreateDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </Flex>
  )
}

const Root = styled.div`
  height: 100%;

  ${(p) => p.theme.breakpoints.up('md')} {
    height: 307px;
    overflow: auto;
  }
`
