import { FileTextIcon, PlusIcon } from '@radix-ui/react-icons'
import { Badge } from '@radix-ui/themes'
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
  PageHelmet,
  PageHeader,
  Text,
  Wrapper,
  DashboardEmptyState,
  LoadFailure,
} from '@/shared'
import { DashboardEmptyStateImage } from '@/shared'

export default function DashboardPage() {
  const { t } = useTranslation()
  const [createProjectOpen, setCreateProjectOpen] = useState(false)

  const {
    fetchProjects: fetchProjectsEvent,
    projectsLoading,
    projectsFailed,
    periodFailed,
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
  const periodTotals = useMemo(() => {
    const rates = new Map(
      projects.map((project) => [project.id, Number(project.rateHour) || 0]),
    )

    return Object.fromEntries(
      (periodRows ?? []).map((row) => [
        row.projectId,
        {
          minutes: Math.round(row.trackedSeconds / 60),
          minutesActive: Math.round((row.activeSeconds ?? 0) / 60),
          paid:
            ((row.paidSeconds ?? 0) / 3600) * (rates.get(row.projectId) ?? 0),
        },
      ]),
    ) as ProjectsTablePeriodTotals
  }, [periodRows, projects])

  // While loading, the projects table renders as skeletons so the layout does
  // not jump. Once loaded, an account with no projects gets the
  // intro screen instead of an empty table: a new account starts with nothing,
  // and creating the first project is the only thing to do here.
  const showContent = !projectsFailed && (projectsLoading || hasProjects)
  // Reserve the chart column while projects load so the layout does not jump.
  // The card stays up even when nothing tracks processes yet — its empty state
  // is what tells people the feature exists.
  const showCharts = projectsLoading || hasProjects

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
        noindex
      />
      <Wrapper>
        <DashboardPremiumBanner />
        {/* The headline figures, then a grid of equal tiles read left to
            right: how and when the work happened beside the period day by
            day, the projects beside the app breakdown, what agents did and
            what they were asked, and - for an owner - who did it. The
            worklogs live on /time. */}
        {/* The intro's hero already reads "Dashboard", so the page title only
            comes back once there is something under it. */}
        {(showContent || projectsFailed) && (
          <Overview>
            <PageHeader
              title={t('dashboard.page.title')}
              actions={showContent ? <DashboardFilterBar /> : null}
            />
            {showContent && <DashboardSummary />}
          </Overview>
        )}
        {/* A failed load is not a new account: offering "create your first
            project" here would duplicate work the account already has. */}
        {projectsFailed ? (
          <LoadFailure
            title={t('dashboard.page.loadFailure.title')}
            description={t('dashboard.page.loadFailure.description')}
            onRetry={load}
          />
        ) : showContent ? (
          <Sections initial="hidden" animate="shown" variants={reveal.list}>
            {/* About tracking, agents and screenshots: nothing a viewer can
                ever have, so they are left out instead of empty. */}
            {canTrack && (
              <Tile variants={reveal.item}>
                <DashboardInsights />
              </Tile>
            )}
            <Tile variants={reveal.item}>
              <DashboardTimeDaily />
            </Tile>
            <Tile variants={reveal.item}>
              <DashboardWidget
                title={t('dashboard.page.projects.title')}
                aside={
                  <ProjectsTools>
                    {/* No count until there is one: "0 projects" over the
                        loading rows read as an answer. */}
                    {!projectsLoading && (
                      <Badge size={'2'} color={'gray'}>
                        <Text weight={'medium'} size={'1'}>
                          {t('dashboard.page.projectsCount', {
                            count:
                              selectedProjectIds.length > 0
                                ? selectedProjectIds.length
                                : projects.length,
                          })}
                        </Text>
                      </Badge>
                    )}
                    <SearchArea>
                      <DashboardProjectsSearchInput />
                    </SearchArea>
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
                  />
                )}
              </DashboardWidget>
            </Tile>
            {showCharts && (
              <Tile variants={reveal.item}>
                <DashboardApplicationsUsage />
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
                {/* Hidden rather than empty: a period without screenshots
                    is ordinary, and most projects do not take them. */}
                {screenshotsLoaded && screenshots.length > 0 && (
                  <Tile variants={reveal.item}>
                    <DashboardWidget title={t('dashboard.screenshots.title')}>
                      <TimeScreenshotStrip entries={screenshots} />
                    </DashboardWidget>
                  </Tile>
                )}
              </>
            )}
            {isOwner && (
              <Tile variants={reveal.item}>
                <DashboardTeam />
              </Tile>
            )}
          </Sections>
        ) : (
          <Intro
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
      </Wrapper>
    </>
  )
}

const REVEAL = {
  list: { shown: { transition: { staggerChildren: 0.06 } } },
  item: {
    hidden: { opacity: 0, y: 8 },
    shown: { opacity: 1, y: 0, transition: { duration: 0.24 } },
  },
}

const REVEAL_STILL = {
  list: {},
  item: { hidden: { opacity: 1 }, shown: { opacity: 1 } },
}

/* Equal tiles, two across on a desktop and one on anything narrower. A
   row's tiles share its height, so neighbours end on the same line. */
const Sections = styled(motion.div)`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-4);

  ${(p) => p.theme.breakpoints.up('lg')} {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`

/* The reveal's handle on a tile; a grid itself, so the tile fills the cell. */
const Tile = styled(motion.div)`
  display: grid;
  min-width: 0;
`

/* The same gap as between the tiles below: the stat strip is their first row. */
const Overview = styled.div`
  display: grid;
  gap: var(--space-4);
  margin-bottom: var(--space-4);

  ${(p) => p.theme.breakpoints.down('md')} {
    gap: var(--space-3);
  }
`

/* The intro takes the place of the projects table, so it gets the room it
   would have had rather than sitting flush under the title. */
const Intro = styled(DashboardEmptyState)`
  padding: var(--space-6) 0 var(--space-8);

  ${(p) => p.theme.breakpoints.down('md')} {
    padding: var(--space-4) 0 var(--space-6);
  }
`

/* The count and the search share the title row; on a phone the row wraps
   and the search takes a line of its own rather than squeezing the title. */
const ProjectsTools = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-3);
  flex: 1;
  min-width: 0;

  ${(p) => p.theme.breakpoints.down('md')} {
    flex-basis: 100%;
    flex-wrap: wrap;
    justify-content: flex-start;
  }
`

const SearchArea = styled.div`
  width: 240px;
  max-width: 100%;

  ${(p) => p.theme.breakpoints.down('md')} {
    flex: 1;
    min-width: 200px;
  }
`
