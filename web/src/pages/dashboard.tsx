import { Badge, Flex } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  fetchActivities,
  $activitiesLoading,
  $hasProjects,
  $activities,
} from '@/entities/activities'
import {
  ApplicationsUsage,
  WorklogsTable,
  ProjectsTable,
  CreateProjectModal,
  DashboardStyles as S,
  ProjectsSearchInput,
} from '@/features/dashboard'
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
    fetchActivities: fetchActivitiesEvent,
    activitiesLoading,
    hasProjects,
    activities,
  } = useUnit({
    fetchActivities,
    activitiesLoading: $activitiesLoading,
    hasProjects: $hasProjects,
    activities: $activities,
  })

  const showSkeletons = activitiesLoading || hasProjects

  useEffect(() => {
    fetchActivitiesEvent()
  }, [fetchActivitiesEvent])

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
                      count: activities.length,
                    })}
                  </Text>
                </Badge>
              </Flex>
              {showSkeletons && (
                <Flex mb={{ initial: '3', sm: '0' }}>
                  <ProjectsSearchInput />
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
              <ApplicationsUsage />
            </S.Right>
          )}
        </S.Content>
        <CreateProjectModal
          open={createProjectOpen}
          onOpenChange={setCreateProjectOpen}
        />
        {showSkeletons ? (
          <WorklogsTable />
        ) : (
          <DashboardEmptyState
            title={t('dashboard.page.empty.title')}
            description={t('dashboard.page.empty.description')}
            actionLabel={t('dashboard.page.empty.action')}
            buttonThemeVariant="primary"
            buttonSize={'3'}
          />
        )}
      </Wrapper>
    </>
  )
}
