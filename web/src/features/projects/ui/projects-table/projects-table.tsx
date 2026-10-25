import { TrashIcon, PlusIcon } from '@radix-ui/react-icons'
import { Flex } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useMemo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import {
  $canDeleteAllProjects,
  $isProjectCreateDialogOpen,
  $isProjectDialogOpen,
  $projectSelection,
  $selectedProject,
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

export type ProjectsTablePeriodTotals = Record<
  string,
  { minutes: number; minutesActive: number; paid: number }
>

type ProjectsTableProps = {
  /** Only these projects; empty or missing shows every one. */
  projectIds?: string[]
  /**
   * Time for a period instead of all time. A project missing from it tracked
   * nothing in the period.
   */
  periodTotals?: ProjectsTablePeriodTotals
  /** Details shown when the pointer rests on a project's name. */
  projectPopup?: (row: ProjectWithStats) => ReactNode
}

export const ProjectsTable = ({
  projectIds,
  periodTotals,
  projectPopup,
}: ProjectsTableProps = {}) => {
  const isMobile = useBreakpoint('isMobile')

  const {
    projects: allProjects,
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
  })

  const projects = useMemo(() => {
    const selected = projectIds?.length ? new Set(projectIds) : null
    const rows = selected
      ? allProjects.filter((project) => selected.has(project.id ?? ''))
      : allProjects

    if (!periodTotals) {
      return rows
    }

    return rows.map((project) => ({
      ...project,
      minutes: periodTotals[project.id ?? '']?.minutes ?? 0,
      minutesActive: periodTotals[project.id ?? '']?.minutesActive ?? 0,
      paid: periodTotals[project.id ?? '']?.paid ?? 0,
    }))
  }, [allProjects, projectIds, periodTotals])

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
      // Widths are what each column's longest value needs and no more: the
      // table shares a dashboard row with another tile, so five columns have
      // to fit in half the page.
      {
        dataKey: 'createdAt',
        width: 116,
        headerText: t('dashboard.projectsTable.drawer.meta.createdAt'),
        getValue: (data: ProjectWithStats) =>
          dateFormatter.format(new Date(data.createdAt ?? new Date())),
      },
      {
        dataKey: 'title',
        width: 148,
        headerText: t('dashboard.projectsTable.head.projectName'),
      },
      {
        dataKey: 'state',
        width: 68,
        horizontalAlign: 'center',
        headerText: t('dashboard.projectsTable.head.status'),
      },
      {
        // `mapProjectsAndStats` prefers the project's own rate over the totals
        // row, so a project with nothing tracked yet still shows its rate
        // rather than $0.00.
        dataKey: 'rateHour',
        width: 76,
        headerText: t('dashboard.projectsTable.drawer.meta.rateHour'),
        description: t('common.metricDesc.rateHour'),
        getValue: (data) => formatCurrency(data.rateHour),
      },
      {
        customKey: 'timeTotal',
        width: 108,
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
      // Input counts are only known for all time; beside a period's hours
      // they would read as that period's.
      ...(periodTotals
        ? []
        : ([
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
          ] satisfies MobileDataTableConfig<ProjectWithStats>)),
    ],
    [t, periodTotals],
  )

  const projectsContextValues = useMemo(
    (): ProjectsTableContextValues => ({
      handleActionClick,
      t,
      projectPopup,
    }),
    [handleActionClick, t, projectPopup],
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

  /* Grows with the tile around it, so the table ends level with whatever
     sits beside it, and never shorter than four rows. */
  ${(p) => p.theme.breakpoints.up('md')} {
    flex: 1;
    min-height: 307px;
    overflow: auto;

    /* Half the table's usual cell inset: the room five columns need in half
       a page comes out of the gutters, not the values. */
    & th,
    & td {
      padding-inline: 6px;
    }
  }
`
