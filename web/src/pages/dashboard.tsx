import { PlusIcon } from '@radix-ui/react-icons'
import { Badge, Flex } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import {
  fetchProjects,
  $projectsLoading,
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

  const {
    fetchProjects: fetchProjectsEvent,
    fetchTime: fetchTimeEvent,
    projectsLoading,
    timeLoading,
    hasProjects,
    projects,
  } = useUnit({
    fetchProjects,
    fetchTime,
    projectsLoading: $projectsLoading,
    timeLoading: $timeLoading,
    hasProjects: $hasProjects,
    projects: $projects,
  })

  const showSkeletons = projectsLoading || timeLoading || hasProjects
  // Reserve the chart column while projects load so the layout does not jump.
  // The card stays up even when nothing tracks processes yet — its empty state
  // is what tells people the feature exists.
  const showCharts = projectsLoading || hasProjects

  useEffect(() => {
    fetchProjectsEvent()
    fetchTimeEvent()
  }, [fetchProjectsEvent, fetchTimeEvent])

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
        <Overview>
          <PageTitle>{t('dashboard.page.title')}</PageTitle>
          <DashboardSummary />
        </Overview>
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
              {showSkeletons && (
                <SearchArea>
                  <DashboardProjectsSearchInput />
                </SearchArea>
              )}
            </ProjectsHead>
            {showSkeletons && (
              <S.TableArea>
                <ProjectsTable />
              </S.TableArea>
            )}
          </S.Main>
          {showCharts && (
            <S.Aside>
              <DashboardApplicationsUsage />
            </S.Aside>
          )}
        </S.Content>
        <ProjectsCreateModal
          open={createProjectOpen}
          onOpenChange={setCreateProjectOpen}
        />
        {showSkeletons ? (
          <TimeWorklogs />
        ) : (
          <DashboardEmptyState
            imageSrc={DashboardEmptyStateImage}
            title={t('dashboard.page.empty.title')}
            description={t('dashboard.page.empty.description')}
            actionLabel={t('dashboard.page.empty.action')}
            size="l"
            buttonIcon={<PlusIcon width={18} height={18} />}
            onAction={() => setCreateProjectOpen(true)}
          />
        )}
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
