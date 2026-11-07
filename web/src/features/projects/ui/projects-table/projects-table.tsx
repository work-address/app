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
  $projectSort,
  $selectedProject,
  PROJECT_SORT_FIELDS,
  projectCreateDialogOpenChanged,
  projectDeleteRequested,
  projectDialogOpenChanged,
  projectEditRequested,
  projectSelectionChanged,
  projectSortChanged,
  projectStateTabChanged,
  sortProjects,
  type ProjectSort,
  type ProjectSortField,
} from '../../model'
import { ProjectsCreateModal } from '../projects-create-modal'
import { ProjectsDialog } from '../projects-dialog/projects-dialog'
import {
  ProjectsMobileAddonBottom,
  ProjectsMobileBody,
  ProjectsMobileHeader,
} from '../projects-mobile'

import { ProjectsOverviewTable } from './projects-overview-table'
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
  workspaceDesign,
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
  SortSelect,
  Tooltip,
  useBreakpoint,
  ProjectsEmptyState,
} from '@/shared'

const rowIdGetter = (row: ProjectWithStats) => row.id ?? ''

export type ProjectsTablePeriodTotals = Record<
  string,
  {
    minutes: number
    minutesActive?: number
    paidCents?: number
    earnedCents?: number
  }
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
  /** Optional search control supplied by the dashboard. */
  search?: ReactNode
  /** A surrounding card can supply the create action in its header. */
  showCreateAction?: boolean
}

export const ProjectsTable = ({
  projectIds,
  periodTotals,
  projectPopup,
  search,
  showCreateAction = true,
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
    sort,
    changeSort,
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
    sort: $projectSort,
    changeSort: projectSortChanged,
  })

  const projects = useMemo(() => {
    const selected = projectIds?.length ? new Set(projectIds) : null
    const rows = selected
      ? allProjects.filter((project) => selected.has(project.id ?? ''))
      : allProjects

    if (!periodTotals) {
      return sortProjects(rows, sort)
    }

    // Sorted after the period is applied, so the order follows the hours shown.
    return sortProjects(
      rows.map((project) => {
        const period = periodTotals[project.id ?? '']
        // A viewer has no activity or money figures, in any period.
        const seesDetail = project.role !== 'viewer'

        return {
          ...project,
          minutes: period?.minutes ?? 0,
          minutesActive: seesDetail ? (period?.minutesActive ?? 0) : undefined,
          paidCents: seesDetail ? (period?.paidCents ?? 0) : undefined,
          earnedCents: seesDetail ? (period?.earnedCents ?? 0) : undefined,
        }
      }),
      sort,
    )
  }, [allProjects, projectIds, periodTotals, sort])

  const renderingData = isProjectsLoading ? [] : projects

  const { t } = useTranslation()

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
      // The project name takes the largest share of the full-width table.
      // Dates and additional details remain in the project's popup/dialog.
      {
        dataKey: 'title',
        width: 148,
        headerText: t('dashboard.projectsTable.head.projectName'),
        sortable: true,
      },
      {
        dataKey: 'state',
        width: 68,
        horizontalAlign: 'center',
        headerText: t('dashboard.projectsTable.head.status'),
        sortable: true,
      },
      {
        // `mapProjectsAndStats` prefers the project's own rate over the totals
        // row, so a project with nothing tracked yet still shows its rate
        // rather than $0.00.
        dataKey: 'rateHour',
        width: 76,
        headerText: t('dashboard.projectsTable.drawer.meta.rateHour'),
        description: t('common.metricDesc.rateHour'),
        getValue: (data) =>
          data.rateHour === undefined ? '—' : formatCurrency(data.rateHour),
        sortable: true,
      },
      {
        customKey: 'timeTotal',
        width: 108,
        headerText: t('dashboard.projectsTable.head.timeTotal'),
        description: t('common.metricDesc.timeTotal'),
        sortable: true,
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
              getValue: (data) =>
                data.keyboardKeys === undefined
                  ? '—'
                  : formatCount(data.keyboardKeys),
            },
            {
              dataKey: 'mouseKeys',
              headerText: t('dashboard.projectsTable.head.mouseKeys'),
              description: t('common.metricDesc.mouse'),
              getValue: (data) =>
                data.mouseKeys === undefined
                  ? '—'
                  : formatCount(data.mouseKeys),
            },
            {
              dataKey: 'mouseDistance',
              headerText: t('dashboard.projectsTable.head.mouseDistance'),
              description: t('common.metricDesc.mouseDistance'),
              getValue: (data) =>
                data.mouseDistance === undefined
                  ? '—'
                  : formatCount(data.mouseDistance),
            },
          ] satisfies MobileDataTableConfig<ProjectWithStats>)),
    ],
    [t, periodTotals],
  )

  const sortOptions = useMemo(
    () =>
      PROJECT_SORT_FIELDS.map((entry) => ({
        value: entry.field,
        label: t(entry.labelKey),
      })),
    [t],
  )

  const [sortField, sortOrder] = Object.entries(sort)[0] as [
    ProjectSortField,
    NonNullable<ProjectSort[ProjectSortField]>,
  ]

  const projectsContextValues = useMemo(
    (): ProjectsTableContextValues => ({
      handleActionClick,
      t,
      projectPopup,
    }),
    [handleActionClick, t, projectPopup],
  )

  return (
    <Root data-overview={Boolean(periodTotals) || undefined}>
      <Toolbar>
        {periodTotals ? (
          <Filters aria-label={t('dashboard.projectsTable.head.status')}>
            {(['All', 'Active', 'Inactive'] as const).map((state) => (
              <Filter
                key={state}
                type="button"
                aria-pressed={filter.projectState === state}
                onClick={() => changeStateTab(state)}
              >
                {t(`dashboard.page.tabs.${state.toLowerCase()}`)}
              </Filter>
            ))}
          </Filters>
        ) : (
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
        )}
        {(search || periodTotals) && (
          <Tools>
            {search && <Search>{search}</Search>}
            {periodTotals && projects.length > 1 && (
              <SortSelect
                options={sortOptions}
                field={sortField}
                order={sortOrder}
                onChange={(field, order) => changeSort({ [field]: order })}
              />
            )}
          </Tools>
        )}
        {(allowDeleteAll || showCreateAction) && (
          <Actions>
            {allowDeleteAll && (
              <>
                {isMobile ? (
                  <Tooltip content={t('dashboard.page.deleteAll')}>
                    <ActionIcon
                      variant={'outline'}
                      color={'red'}
                      aria-label={t('dashboard.page.deleteAll')}
                    >
                      <TrashIcon />
                    </ActionIcon>
                  </Tooltip>
                ) : (
                  <Action
                    color="danger"
                    variant="outline"
                    iconLeft={<TrashIcon />}
                  >
                    {t('dashboard.page.deleteAll')}
                  </Action>
                )}
              </>
            )}
            {showCreateAction &&
              (isMobile ? (
                <Tooltip content={t('dashboard.page.createProject')}>
                  <ActionIcon
                    themeVariant={'primary'}
                    onClick={() => setCreateDialogOpen(true)}
                    aria-label={t('dashboard.page.createProject')}
                  >
                    <PlusIcon />
                  </ActionIcon>
                </Tooltip>
              ) : (
                <Action
                  iconLeft={<PlusIcon />}
                  onClick={() => setCreateDialogOpen(true)}
                >
                  {t('dashboard.page.createProject')}
                </Action>
              ))}
          </Actions>
        )}
      </Toolbar>
      {/* A phone's cards have no column headers to sort from. */}
      {isMobile && !periodTotals && projects.length > 1 && (
        <Flex pb={'3'}>
          <SortSelect
            options={sortOptions}
            field={sortField}
            order={sortOrder}
            onChange={(field, order) => changeSort({ [field]: order })}
          />
        </Flex>
      )}
      <Body data-overview={Boolean(periodTotals) || undefined}>
        <AnimatePresence mode={'wait'}>
          <motion.div
            key={filter.projectState}
            style={{ height: '100%' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: workspaceDesign.motion.filterDuration }}
          >
            {projects.length === 0 && !isProjectsLoading ? (
              <ProjectsEmptyState
                onCreateClick={() => setCreateDialogOpen(true)}
              />
            ) : (
              <ProjectsTableContext value={projectsContextValues}>
                {periodTotals ? (
                  <ProjectsOverviewTable
                    projects={renderingData}
                    loading={isProjectsLoading}
                    isFiltering={isProjectDeleting || isProjectsFiltering}
                    sort={sort}
                    onSortChange={changeSort}
                    onOpen={requestEdit}
                    projectPopup={projectPopup}
                  />
                ) : isMobile ? (
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
                    sort={sort}
                    onSortChange={changeSort}
                    onRowClick={handleActionClick}
                  />
                )}
              </ProjectsTableContext>
            )}
          </motion.div>
        </AnimatePresence>
      </Body>
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
    </Root>
  )
}

const Root = styled.div`
  container: projects-table / inline-size;
  display: grid;
  align-content: start;
  min-width: 0;
  height: 100%;

  &[data-overview] {
    --projects-tools-gap: var(--ui-space-3);
    --projects-actions-gap: var(--ui-space-2);
    --projects-search-width: var(--ui-search-width);
    --projects-body-min-height: var(--ui-table-body-min-height);
    --sort-select-height: var(--ui-control-height);
    --sort-select-segment-height: var(--ui-segment-height);
    --sort-select-radius: var(--ui-icon-radius);
    --sort-select-segment-radius: var(--ui-row-radius);
    --sort-select-border: var(--ui-line);
    --sort-select-background: var(--ui-surface);
    --sort-select-font-size: var(--ui-meta-size);
    --sort-select-padding: var(--ui-space-2);
  }
`

const Toolbar = styled.div`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--projects-tools-gap, var(--space-3));
  margin-bottom: var(--space-3);

  ${Root}[data-overview] & {
    margin-bottom: var(--ui-section-gap);
  }

  /* Component fit: the dashboard can place this table in a half-width card. */
  @container projects-table (max-width: ${workspaceDesign.container
    .compact}px) {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  ${(p) => p.theme.breakpoints.down('lg')} {
    grid-template-columns: minmax(0, 1fr) auto;
  }
`

const Filters = styled.div`
  display: grid;
  grid-auto-flow: column;
  width: fit-content;
  gap: var(--ui-space-1);
  padding: var(--ui-space-1);
  border-radius: var(--ui-icon-radius);
  background: var(--ui-inset);
`

const Filter = styled.button`
  min-height: var(--ui-segment-height);
  padding-inline: var(--ui-space-4);
  border-radius: var(--ui-row-radius);
  color: var(--ui-muted);
  font-size: var(--ui-meta-size);
  line-height: var(--ui-meta-line-height);

  &[aria-pressed='true'] {
    color: var(--ui-ink);
    background: var(--ui-surface);
    box-shadow: var(--ui-shadow);
  }

  &:focus-visible {
    outline: var(--ui-focus-width) solid var(--ui-blue);
    outline-offset: var(--ui-focus-offset);
  }

  @container projects-table (max-width: ${workspaceDesign.container
    .compact}px) {
    padding-inline: var(--ui-space-3);
  }

  @container projects-table (max-width: ${workspaceDesign.container.narrow}px) {
    padding-inline: var(--ui-space-2);
  }

  ${(p) => p.theme.breakpoints.down('md')} {
    padding-inline: var(--ui-space-3);
  }
`

const Tools = styled.div`
  display: grid;
  grid-template-columns: minmax(0, var(--projects-search-width, 240px)) auto;
  align-items: center;
  gap: var(--projects-tools-gap, var(--space-3));
  justify-self: end;
  min-width: 0;

  @container projects-table (max-width: ${workspaceDesign.container
    .compact}px) {
    grid-column: 1 / -1;
    grid-row: 2;
    grid-template-columns: minmax(0, 1fr) auto;
    width: 100%;
  }

  ${(p) => p.theme.breakpoints.down('xl')} {
    grid-column: 1 / -1;
    grid-row: 2;
    grid-template-columns: minmax(0, 1fr) auto;
    width: 100%;
  }

  ${(p) => p.theme.breakpoints.down('md')} {
    grid-template-columns: minmax(0, 1fr);
  }
`

const Search = styled.div`
  min-width: 0;
`

const Actions = styled.div`
  display: grid;
  grid-auto-flow: column;
  justify-self: end;
  gap: var(--projects-actions-gap, var(--space-2));

  @container projects-table (max-width: ${workspaceDesign.container
    .compact}px) {
    grid-row: 1;
    grid-column: 2;
  }

  ${(p) => p.theme.breakpoints.down('lg')} {
    grid-row: 1;
    grid-column: 2;
  }
`

const Action = styled(Button)`
  ${Root}[data-overview] & {
    min-height: var(--ui-control-height);
    border-radius: var(--ui-icon-radius);
    padding-inline: var(--ui-space-3);
    font-size: var(--ui-meta-size);
  }
`

const ActionIcon = styled(IconButton)`
  ${Root}[data-overview] & {
    width: var(--ui-control-height);
    height: var(--ui-control-height);
    border-radius: var(--ui-icon-radius);
  }
`

const Body = styled.div`
  min-width: 0;

  /* Grows with the tile around it, so the table ends level with whatever
     sits beside it, and never shorter than its header and four rows. */
  ${(p) => p.theme.breakpoints.up('md')} {
    min-height: var(--projects-body-min-height, 244px);
    overflow: visible;

    /* Optional dashboard spacing leaves the reusable table's defaults alone. */
    &:not([data-overview]) th,
    &:not([data-overview]) td {
      padding-inline: var(--projects-cell-inset-x, 6px);
    }

    &:not([data-overview]) td {
      padding-block: var(--projects-cell-inset-y, var(--space-2));
    }
  }
`
