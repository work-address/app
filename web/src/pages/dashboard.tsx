import { FileTextIcon, PlusIcon } from '@radix-ui/react-icons'
import { Badge, Flex } from '@radix-ui/themes'
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
  ListPageLayout as S,
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
        {/* The page reads top-down: the headline figures, the period day by
            day, the projects beside the app breakdown, then how and when the
            work happened, what agents did, and - for an owner - who did it.
            The worklogs live on /time. */}
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
            <motion.div variants={reveal.item}>
              <DashboardTimeDaily />
            </motion.div>
            <S.Content as={motion.div} variants={reveal.item}>
              <S.Main>
                <ProjectsHead>
                  <Flex align={'center'} gap={'2'} style={{ minWidth: 0 }}>
                    <S.SectionTitle>
                      {t('dashboard.page.projects.title')}
                    </S.SectionTitle>
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
                  </Flex>
                  <SearchArea>
                    <DashboardProjectsSearchInput />
                  </SearchArea>
                </ProjectsHead>
                <S.TableArea>
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
                </S.TableArea>
              </S.Main>
              {showCharts && (
                <S.Aside>
                  <DashboardApplicationsUsage />
                </S.Aside>
              )}
            </S.Content>
            {/* About tracking, agents and screenshots: nothing a viewer can
                ever have, so they are left out instead of empty. */}
            {canTrack && (
              <>
                <Pair variants={reveal.item}>
                  <DashboardInsights />
                  <DashboardAgents />
                </Pair>
                <Pair variants={reveal.item}>
                  <DashboardRecentPrompts />
                  {/* Hidden rather than empty: a period without screenshots
                      is ordinary, and most projects do not take them. */}
                  {screenshotsLoaded && screenshots.length > 0 && (
                    <DashboardWidget title={t('dashboard.screenshots.title')}>
                      <TimeScreenshotStrip entries={screenshots} />
                    </DashboardWidget>
                  )}
                </Pair>
              </>
            )}
            {isOwner && (
              <motion.div variants={reveal.item}>
                <DashboardTeam />
              </motion.div>
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

const Sections = styled(motion.div)`
  display: grid;
  gap: var(--space-7);

  ${(p) => p.theme.breakpoints.down('md')} {
    gap: var(--space-6);
  }
`

/* Two widgets side by side on a desktop; a lone one takes the row. */
const Pair = styled(motion.div)`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 420px), 1fr));
  gap: var(--space-6);
`

const Overview = styled.div`
  display: grid;
  gap: var(--space-4);
  margin-bottom: var(--space-6);

  ${(p) => p.theme.breakpoints.down('md')} {
    gap: var(--space-3);
    margin-bottom: var(--space-5);
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

/* The search belongs to the projects group, so it sits beside the title
   rather than being pushed to the far edge. On a phone it takes its own line
   rather than squeezing the title. */
const ProjectsHead = styled(S.SectionTitleRow)`
  flex-wrap: wrap;
  justify-content: flex-start;

  ${(p) => p.theme.breakpoints.up('md')} {
    gap: var(--space-5);
  }
`

const SearchArea = styled.div`
  width: 280px;
  max-width: 100%;

  ${(p) => p.theme.breakpoints.down('md')} {
    width: 100%;
  }
`
