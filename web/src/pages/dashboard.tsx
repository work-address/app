import { PlusIcon } from '@radix-ui/react-icons'
import { Badge, Flex } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import styled from 'styled-components'

import {
  fetchProjects,
  $focusedProject,
  $projectsLoading,
  $hasProjects,
  $projects,
  changeProjectStateFilter,
  FOCUSED_PROJECT_PARAM,
  readFocusedProjectParam,
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
  SectionTitle,
  Text,
  Wrapper,
  DashboardEmptyState,
  ListPageLayout as S,
} from '@/shared'
import { DashboardEmptyStateImage } from '@/shared'

export default function DashboardPage() {
  const { t, i18n } = useTranslation()
  const [createProjectOpen, setCreateProjectOpen] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()

  const {
    fetchProjects: fetchProjectsEvent,
    fetchTime: fetchTimeEvent,
    projectsLoading,
    timeLoading,
    hasProjects,
    projects,
    focused,
    changeProjectStateFilterEvent,
  } = useUnit({
    fetchProjects,
    fetchTime,
    projectsLoading: $projectsLoading,
    timeLoading: $timeLoading,
    hasProjects: $hasProjects,
    projects: $projects,
    focused: $focusedProject,
    changeProjectStateFilterEvent: changeProjectStateFilter,
  })

  // `/?project=<id>` is how the marketplace's "Track time" button arrives:
  // the dashboard opens on the project that contract's hire created. The
  // parameter is the source of truth, so going back or editing the URL by
  // hand changes what is shown, and clearing the focus clears the link too.
  const focusedParam = readFocusedProjectParam(searchParams)

  useEffect(() => {
    changeProjectStateFilterEvent({ focusedProjectId: focusedParam })
  }, [changeProjectStateFilterEvent, focusedParam])

  const showAllProjects = () => {
    const next = new URLSearchParams(searchParams)

    next.delete(FOCUSED_PROJECT_PARAM)
    setSearchParams(next, { replace: true })
  }

  // While loading, the projects table and worklogs render as skeletons so the
  // layout does not jump. Once loaded, an account with no projects gets the
  // intro screen instead of an empty table: a new account starts with nothing,
  // and creating the first project is the only thing to do here.
  const showContent = projectsLoading || timeLoading || hasProjects
  // Reserve the chart column while projects load so the layout does not jump.
  // The card stays up even when nothing tracks processes yet — its empty state
  // is what tells people the feature exists.
  const showCharts = projectsLoading || hasProjects

  useEffect(() => {
    fetchProjectsEvent()
    fetchTimeEvent()
  }, [fetchProjectsEvent, fetchTimeEvent])

  // A link to a project this account cannot open is answered in its own
  // right, not by quietly showing the full dashboard: someone who followed
  // it would otherwise believe they were looking at the project it named.
  if (focused.kind === 'no-access') {
    return (
      <>
        <PageHelmet
          htmlAttributes={{ lang: i18n.language }}
          title={t('dashboard.page.title')}
        />
        <Wrapper>
          <Intro
            data-testid="focused-project-no-access"
            imageSrc={DashboardEmptyStateImage}
            title={t('dashboard.page.focused.title')}
            description={t('dashboard.page.focused.description')}
            actionLabel={t('dashboard.page.focused.action')}
            size="l"
            onAction={showAllProjects}
          />
        </Wrapper>
      </>
    )
  }

  return (
    <>
      <PageHelmet
        htmlAttributes={{ lang: i18n.language }}
        title={t('dashboard.page.title')}
      />
      <Wrapper>
        <DashboardPremiumBanner />
        {/* The page reads top-down: the headline figures, then the projects
            they come from beside the app breakdown, then the worklog feed. */}
        {/* The intro's hero already reads "Dashboard", so the page title only
            comes back once there is something under it. */}
        {showContent && (
          <Overview>
            <PageTitle>{t('dashboard.page.title')}</PageTitle>
            <DashboardSummary />
          </Overview>
        )}
        {showContent ? (
          <>
            <S.Content>
              <S.Main>
                <ProjectsHead>
                  <Flex align={'center'} gap={'2'} style={{ minWidth: 0 }}>
                    <S.SectionTitle>
                      {t('dashboard.page.projects.title')}
                    </S.SectionTitle>
                    <Badge size={'2'} color={'gray'}>
                      <Text weight={'medium'} size={'1'}>
                        {t('dashboard.page.projectsCount', {
                          count: projects.length,
                        })}
                      </Text>
                    </Badge>
                  </Flex>
                  {focused.kind === 'focused' ? (
                    <ShowAll
                      type="button"
                      data-testid="focused-project-show-all"
                      onClick={showAllProjects}
                    >
                      {t('dashboard.page.focused.showAll')}
                    </ShowAll>
                  ) : null}
                  <SearchArea>
                    <DashboardProjectsSearchInput />
                  </SearchArea>
                </ProjectsHead>
                <S.TableArea>
                  <ProjectsTable />
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

const PageTitle = styled(SectionTitle).attrs({ as: 'h1' })`
  ${(p) => p.theme.breakpoints.up('md')} {
    font-size: var(--font-size-7);
  }
`

const Overview = styled.div`
  display: flex;
  flex-direction: column;
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

/* The way out of a one-project view, beside the count it narrowed. */
const ShowAll = styled.button`
  padding: 0;
  border: 0;
  background: none;
  color: var(--accent-11);
  font: inherit;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 3px;

  &:hover {
    text-decoration-color: currentColor;
  }
`

const SearchArea = styled.div`
  width: 280px;
  max-width: 100%;

  ${(p) => p.theme.breakpoints.down('md')} {
    width: 100%;
  }
`
