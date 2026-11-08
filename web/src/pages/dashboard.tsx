import { FileTextIcon, PlusIcon } from '@radix-ui/react-icons'
import { useUnit } from 'effector-react'
import { motion, useReducedMotion } from 'motion/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import {
  fetchProjects,
  $projectsLoading,
  $projectsFailed,
  $hasProjects,
  $projects,
} from '@/entities/projects'
import { statisticsOverviewQuery } from '@/entities/statistics'
import { recentScreenshotsQuery } from '@/entities/time'
import {
  DashboardAgents,
  DashboardApplicationsUsage,
  DashboardDesktopSession,
  DashboardFilterBar,
  DashboardInsights,
  DashboardProjectPopup,
  DashboardRecentPrompts,
  DashboardTeam,
  DashboardTimeDaily,
  DashboardWidget,
  DashboardPremiumBanner,
  DashboardProjectsSearchInput,
  DashboardSummary,
  $dashboardCanTrack,
  $dashboardProjectIds,
  $dashboardScreenshots,
  $isDashboardOwner,
  dashboardStatisticsRequested,
  useDashboardSearchSync,
} from '@/features/dashboard'
import { OpenInvoiceLink } from '@/features/invoice'
import {
  ProjectsCreateModal,
  ProjectsTable,
  type ProjectsTablePeriodTotals,
} from '@/features/projects'
import { TimeScreenshotStrip } from '@/features/time'
import {
  Button,
  IconButton,
  PageHelmet,
  WorkspaceFreshness,
  WorkspacePage,
  WorkspacePageHeader,
  workspaceDesign,
  DashboardEmptyState,
  LoadFailure,
  Tooltip,
  useBreakpoint,
} from '@/shared'
import { DashboardEmptyStateImage } from '@/shared'

export default function DashboardPage() {
  const { t } = useTranslation()
  const isMobile = useBreakpoint('isMobile')
  const [createProjectOpen, setCreateProjectOpen] = useState(false)

  const {
    fetchProjects: fetchProjectsEvent,
    projectsLoading,
    projectsFailed,
    periodFailed,
    periodPending,
    retryPeriod,
    hasProjects,
    projects,
    periodRows,
    selectedProjectIds,
    screenshots,
    screenshotsLoaded,
    isOwner,
    canTrack,
  } = useUnit({
    fetchProjects,
    projectsLoading: $projectsLoading,
    projectsFailed: $projectsFailed,
    periodFailed: statisticsOverviewQuery.$failed,
    periodPending: statisticsOverviewQuery.$pending,
    retryPeriod: dashboardStatisticsRequested,
    hasProjects: $hasProjects,
    projects: $projects,
    periodRows: statisticsOverviewQuery.$data,
    selectedProjectIds: $dashboardProjectIds,
    screenshots: $dashboardScreenshots,
    screenshotsLoaded: recentScreenshotsQuery.$succeeded,
    isOwner: $isDashboardOwner,
    canTrack: $dashboardCanTrack,
  })

  useDashboardSearchSync()

  // Sections arrive one after another rather than all at once; with reduced
  // motion they simply appear.
  const reducedMotion = useReducedMotion()
  const reveal = reducedMotion ? REVEAL_STILL : REVEAL
  // The table's hover card: the project's details, and invoicing it, the
  // same action its row offers.
  const projectPopup = useCallback(
    (row: { id?: string }) => (
      <DashboardProjectPopup
        projectId={row.id ?? ''}
        variant="plain"
        actions={
          row.id ? (
            <OpenInvoiceLink
              projectId={row.id}
              variant={'button'}
              iconLeft={<FileTextIcon />}
            >
              {t('dashboard.projectsTable.drawer.invoice')}
            </OpenInvoiceLink>
          ) : null
        }
      />
    ),
    [t],
  )

  // The table's time and money follow the period, like the figures above it.
  const periodTotals = useMemo(
    () =>
      Object.fromEntries(
        (periodRows ?? []).map((row) => [
          row.projectId,
          {
            minutes: Math.round(row.trackedSeconds / 60),
            minutesActive:
              row.activeSeconds === undefined
                ? undefined
                : Math.round(row.activeSeconds / 60),
            paidCents: row.paidCents,
            earnedCents: row.earnedCents,
          },
        ]),
      ) as ProjectsTablePeriodTotals,
    [periodRows],
  )

  // While loading, the projects table renders as skeletons so the layout does
  // not jump. Once loaded, an account with no projects gets the
  // intro screen instead of an empty table: a new account starts with nothing,
  // and creating the first project is the only thing to do here.
  const showContent = !projectsFailed && (projectsLoading || hasProjects)
  // Reserve the chart column while projects load so the layout does not jump.
  // The card stays up even when nothing tracks processes yet — its empty state
  // is what tells people the feature exists.
  const showCharts = projectsLoading || hasProjects
  // The reader's own latest session, like their insights: always about them,
  // whoever the people filter selects. Only someone who tracks has one; its
  // place is held while the projects load, so the chart does not narrow.
  const showSession = projectsLoading || canTrack

  const load = useCallback(() => {
    fetchProjectsEvent()
  }, [fetchProjectsEvent])

  useEffect(() => {
    load()
  }, [load])

  return (
    <>
      <PageHelmet
        title={t('dashboard.page.title')}
        description={t('dashboard.page.meta')}
      />
      <WorkspacePage>
        <DashboardPremiumBanner />
        {/* The intro's hero already reads "Dashboard", so the page title only
            comes back once there is something under it. */}
        {(showContent || projectsFailed) && (
          <Overview>
            <WorkspacePageHeader
              eyebrow={t('dashboard.page.eyebrow')}
              title={t('dashboard.page.title')}
              description={t('dashboard.page.description')}
              actions={
                showContent && (
                  <HeaderTools>
                    {/* Whether the figures are the period's latest. */}
                    <Freshness pending={periodPending} failed={periodFailed} />
                    <DashboardFilterBar />
                  </HeaderTools>
                )
              }
            />
            {showContent && <DashboardSummary />}
          </Overview>
        )}
        {/* A failed load is not a new account: offering "create your first
            project" here would duplicate work the account already has. */}
        {projectsFailed ? (
          <LoadFailure
            size="panel"
            title={t('dashboard.page.loadFailure.title')}
            description={t('dashboard.page.loadFailure.description')}
            onRetry={load}
          />
        ) : showContent ? (
          <Sections initial="hidden" animate="shown" variants={reveal.list}>
            <Tile
              variants={reveal.item}
              data-chart
              data-wide={!showSession || undefined}
            >
              <DashboardTimeDaily />
            </Tile>
            {showSession && (
              <Tile variants={reveal.item} data-session>
                <DashboardDesktopSession />
              </Tile>
            )}
            <Tile variants={reveal.item}>
              <DashboardWidget
                title={t('dashboard.page.projects.title')}
                description={t('dashboard.page.projects.description')}
                aside={
                  <ProjectsTools>
                    {/* No count until there is one: "0 projects" over the
                        loading rows read as an answer. */}
                    {!projectsLoading && (
                      <Count>
                        {t('dashboard.page.projectsCount', {
                          count:
                            selectedProjectIds.length > 0
                              ? selectedProjectIds.length
                              : projects.length,
                        })}
                      </Count>
                    )}
                    {isMobile ? (
                      <Tooltip content={t('dashboard.page.createProject')}>
                        <CreateIcon
                          themeVariant="primary"
                          aria-label={t('dashboard.page.createProject')}
                          onClick={() => setCreateProjectOpen(true)}
                        >
                          <PlusIcon />
                        </CreateIcon>
                      </Tooltip>
                    ) : (
                      <CreateButton
                        iconLeft={<PlusIcon />}
                        onClick={() => setCreateProjectOpen(true)}
                      >
                        {t('dashboard.page.createProject')}
                      </CreateButton>
                    )}
                  </ProjectsTools>
                }
              >
                {periodFailed ? (
                  <LoadFailure
                    title={t('dashboard.projectsTable.totalsFailure.title')}
                    onRetry={retryPeriod}
                  />
                ) : (
                  <ProjectsTable
                    projectIds={selectedProjectIds}
                    periodTotals={periodTotals}
                    projectPopup={projectPopup}
                    search={<DashboardProjectsSearchInput />}
                    showCreateAction={false}
                  />
                )}
              </DashboardWidget>
            </Tile>
            {showCharts && (
              <Tile variants={reveal.item}>
                <DashboardApplicationsUsage />
              </Tile>
            )}
            {/* About tracking, agents and screenshots: nothing a viewer can
                ever have, so they are left out instead of empty. */}
            {canTrack && (
              <Tile variants={reveal.item} data-wide>
                <DashboardInsights wide />
              </Tile>
            )}
            {canTrack && (
              <>
                <Tile variants={reveal.item}>
                  <DashboardAgents />
                </Tile>
                <Tile variants={reveal.item}>
                  <DashboardRecentPrompts />
                </Tile>
              </>
            )}
            {isOwner && (
              <Tile variants={reveal.item} data-wide>
                <DashboardTeam />
              </Tile>
            )}
            {/* A period without screenshots is ordinary. */}
            {canTrack && screenshotsLoaded && screenshots.length > 0 && (
              <Tile variants={reveal.item} data-wide>
                <DashboardWidget title={t('dashboard.screenshots.title')}>
                  <TimeScreenshotStrip entries={screenshots} />
                </DashboardWidget>
              </Tile>
            )}
          </Sections>
        ) : (
          <Intro
            // A new account's whole page: its title is the page's heading.
            titleAs="h1"
            imageSrc={DashboardEmptyStateImage}
            title={t('dashboard.page.empty.title')}
            description={t('dashboard.page.empty.description')}
            actionLabel={t('dashboard.page.empty.action')}
            size="l"
            buttonIcon={<PlusIcon width={18} height={18} />}
            onAction={() => setCreateProjectOpen(true)}
          />
        )}
        <ProjectsCreateModal
          open={createProjectOpen}
          onOpenChange={setCreateProjectOpen}
        />
      </WorkspacePage>
    </>
  )
}

const REVEAL = {
  list: {
    shown: { transition: { staggerChildren: workspaceDesign.motion.stagger } },
  },
  item: {
    hidden: { opacity: 0, y: workspaceDesign.motion.offset },
    shown: {
      opacity: 1,
      y: 0,
      transition: { duration: workspaceDesign.motion.duration },
    },
  },
}

const REVEAL_STILL = {
  list: {},
  item: { hidden: { opacity: 1 }, shown: { opacity: 1 } },
}

const Overview = styled.div`
  display: grid;
  gap: var(--ui-space-5);
  margin-bottom: var(--ui-space-5);
`

/* The status above the filters, both on the right; below xl, the filters'
   own full-width row with the status on the left above it. */
const HeaderTools = styled.div`
  display: grid;
  justify-items: end;
  gap: var(--ui-space-3);
  min-width: 0;

  ${(p) => p.theme.breakpoints.down('xl')} {
    justify-items: stretch;
  }
`

const Freshness = styled(WorkspaceFreshness)`
  ${(p) => p.theme.breakpoints.down('xl')} {
    justify-self: start;
  }
`

const Sections = styled(motion.div)`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--ui-space-5);

  ${(p) => p.theme.breakpoints.up('xl')} {
    grid-template-columns: repeat(12, minmax(0, 1fr));
  }
`

/* The reveal's handle on a tile; a grid itself, so the tile fills the cell. */
const Tile = styled(motion.div)`
  display: grid;
  min-width: 0;

  ${(p) => p.theme.breakpoints.up('xl')} {
    grid-column: span 6;

    &[data-chart] {
      grid-column: span 7;
    }

    &[data-session] {
      grid-column: span 5;
    }
  }

  &[data-wide] {
    grid-column: 1 / -1;
  }
`

/* The intro takes the place of the projects table, so it gets the room it
   would have had rather than sitting flush under the title. */
const Intro = styled(DashboardEmptyState)`
  padding: var(--ui-space-6) 0 var(--ui-space-8);

  ${(p) => p.theme.breakpoints.down('md')} {
    padding: var(--ui-space-4) 0 var(--ui-space-6);
  }
`

/* The count and create action stay together in the card header. */
const ProjectsTools = styled.div`
  display: grid;
  grid-auto-flow: column;
  align-items: center;
  justify-content: end;
  gap: var(--ui-space-3);
  min-width: 0;

  ${(p) => p.theme.breakpoints.down('md')} {
    width: 100%;
  }
`

const Count = styled.span`
  padding: var(--ui-space-2) var(--ui-space-3);
  border-radius: var(--ui-pill-radius);
  background: var(--ui-glow);
  color: var(--ui-blue);
  font-size: var(--ui-meta-size);
  font-weight: var(--ui-weight-medium);
  white-space: nowrap;
`

const CreateButton = styled(Button)`
  min-height: var(--ui-control-height);
  padding-inline: var(--ui-space-3);
  border-radius: var(--ui-icon-radius);
  font-size: var(--ui-meta-size);
`

const CreateIcon = styled(IconButton)`
  width: var(--ui-control-height);
  height: var(--ui-control-height);
  border-radius: var(--ui-icon-radius);
`
