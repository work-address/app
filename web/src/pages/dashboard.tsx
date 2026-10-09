import { PlusIcon } from '@radix-ui/react-icons'
import { Badge, Flex } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import {
  fetchProjects,
  fetchProjectsStats,
  $projectsStatsFailed,
  $projectsLoading,
  $projectsFailed,
  $hasProjects,
  $projects,
} from '@/entities/projects'
import { fetchTime, $timeLoading } from '@/entities/time'
import {
  DashboardApplicationsUsage,
  DashboardPremiumBanner,
  DashboardProjectsSearchInput,
  DashboardSummary,
} from '@/features/dashboard'
import { ProjectsCreateModal, ProjectsTable } from '@/features/projects'
import { TimeWorklogs } from '@/features/time'
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
    fetchTime: fetchTimeEvent,
    projectsLoading,
    projectsFailed,
    projectsStatsFailed,
    retryProjectsStats,
    timeLoading,
    hasProjects,
    projects,
  } = useUnit({
    fetchProjects,
    fetchTime,
    projectsLoading: $projectsLoading,
    projectsFailed: $projectsFailed,
    projectsStatsFailed: $projectsStatsFailed,
    retryProjectsStats: fetchProjectsStats,
    timeLoading: $timeLoading,
    hasProjects: $hasProjects,
    projects: $projects,
  })

  // While loading, the projects table and worklogs render as skeletons so the
  // layout does not jump. Once loaded, an account with no projects gets the
  // intro screen instead of an empty table: a new account starts with nothing,
  // and creating the first project is the only thing to do here.
  const showContent =
    !projectsFailed && (projectsLoading || timeLoading || hasProjects)
  // Reserve the chart column while projects load so the layout does not jump.
  // The card stays up even when nothing tracks processes yet — its empty state
  // is what tells people the feature exists.
  const showCharts = projectsLoading || hasProjects

  const load = useCallback(() => {
    fetchProjectsEvent()
    fetchTimeEvent()
  }, [fetchProjectsEvent, fetchTimeEvent])

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
        {/* The page reads top-down: the headline figures, then the projects
            they come from beside the app breakdown, then the worklog feed. */}
        {/* The intro's hero already reads "Dashboard", so the page title only
            comes back once there is something under it. */}
        {(showContent || projectsFailed) && (
          <Overview>
            <PageHeader title={t('dashboard.page.title')} />
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
          <>
            <S.Content>
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
                            count: projects.length,
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
                  {projectsStatsFailed ? (
                    <LoadFailure
                      title={t('dashboard.projectsTable.totalsFailure.title')}
                      onRetry={retryProjectsStats}
                    />
                  ) : (
                    <ProjectsTable />
                  )}
                </S.TableArea>
              </S.Main>
              {showCharts && (
                <S.Aside>
                  <DashboardApplicationsUsage />
                </S.Aside>
              )}
            </S.Content>
            <TimeWorklogs />
          </>
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

const Overview = styled.div`
  display: grid;
  gap: var(--space-4);
  margin-bottom: var(--space-6);

  ${(p) => p.theme.breakpoints.down('md')} {
    gap: var(--space-3);
    margin-bottom: var(--space-5);
  }
`

/* The intro takes the place of the projects table and the worklogs, so it
   gets the room they would have had rather than sitting flush under the
   title. */
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
