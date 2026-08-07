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
import { fetchWorklogs, $worklogsLoading } from '@/entities/time'
import {
  DashboardApplicationsUsage,
  DashboardProjectsSearchInput,
  DashboardStyles as S,
} from '@/features/dashboard'
import { ProjectsCreateModal, ProjectsTable } from '@/features/projects'
import { TimeTable } from '@/features/time'
import {
  PageHelmet,
  Text,
  Wrapper,
  useBreakpoint,
  DashboardEmptyState,
} from '@/shared'
import { DashboardEmptyStateImage } from '@/shared'

export default function DashboardPage() {
  const isDesktop = useBreakpoint('isDesktop')

  const { t, i18n } = useTranslation()
  const [createProjectOpen, setCreateProjectOpen] = useState(false)

  const {
    fetchProjects: fetchProjectsEvent,
    fetchWorklogs: fetchWorklogsEvent,
    projectsLoading,
    worklogsLoading,
    hasProjects,
    projects,
  } = useUnit({
    fetchProjects,
    fetchWorklogs,
    projectsLoading: $projectsLoading,
    worklogsLoading: $worklogsLoading,
    hasProjects: $hasProjects,
    projects: $projects,
  })

  const showSkeletons = projectsLoading || worklogsLoading || hasProjects

  useEffect(() => {
    fetchProjectsEvent()
    fetchWorklogsEvent()
  }, [fetchProjectsEvent, fetchWorklogsEvent])

  return (
    <>
      <PageHelmet
        htmlAttributes={{ lang: i18n.language }}
        title={t('dashboard.page.title')}
      />
      <Wrapper>
        <S.Content>
          <S.Left>
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
          </S.Left>
          {showSkeletons && (
            <S.Right>
              <DashboardApplicationsUsage />
            </S.Right>
          )}
        </S.Content>
        <ProjectsCreateModal
          open={createProjectOpen}
          onOpenChange={setCreateProjectOpen}
        />
        {showSkeletons ? (
          <TimeTable />
        ) : (
          <DashboardEmptyState
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
