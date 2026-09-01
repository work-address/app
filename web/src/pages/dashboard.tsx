import { PlusIcon } from '@radix-ui/react-icons'
import { Badge, Flex } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

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
} from '@/features/dashboard'
import { ProjectsCreateModal, ProjectsTable } from '@/features/projects'
import { TimeWorklogs } from '@/features/time'
import {
  PageHelmet,
  Text,
  Wrapper,
  useBreakpoint,
  DashboardEmptyState,
  ListPageLayout as S,
} from '@/shared'
import { DashboardEmptyStateImage } from '@/shared'

export default function DashboardPage() {
  const isDesktop = useBreakpoint('isDesktop')

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
        <S.Content>
          <S.Main>
            <Flex
              gap={'10px'}
              align={{ md: 'center' }}
              direction={{ initial: 'column', md: 'row' }}
              mb={{ initial: '3' }}
            >
              <Flex align={'center'} gap={'10px'}>
                <Text size={isDesktop ? '6' : '4'} weight={'medium'}>
                  {t('dashboard.page.title')}
                </Text>
                <Badge size={'2'} color={'gray'}>
                  <Text weight={'medium'} size={'1'}>
                    {t('dashboard.page.projectsCount', {
                      count: projects.length,
                    })}
                  </Text>
                </Badge>
              </Flex>
              {showSkeletons && (
                <Flex mb={{ initial: '3', sm: '0' }}>
                  <DashboardProjectsSearchInput />
                </Flex>
              )}
            </Flex>
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
          />
        )}
      </Wrapper>
    </>
  )
}
