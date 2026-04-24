import { PlusIcon } from '@radix-ui/react-icons'
import { Badge, Flex } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useTranslation } from 'react-i18next'

import {
  fetchActivities,
  $activitiesLoading,
  $hasProjects,
} from '@/entities/activities'
import {
  ApplicationsUsage,
  DashboardEmptyState,
  WorklogsTable,
  ProjectsTable,
  CreateProjectModal,
  DashboardStyles as S,
  Search,
} from '@/features/dashboard'
import { Button, Text, Wrapper, useBreakpoint } from '@/shared'

export default function DashboardPage() {
  const isDesktop = useBreakpoint('isDesktop')

  const { t, i18n } = useTranslation()

  const [createProjectOpen, setCreateProjectOpen] = useState(false)

  const {
    fetchActivities: fetchActivitiesEvent,
    activitiesLoading,
    hasProjects,
  } = useUnit({
    fetchActivities,
    activitiesLoading: $activitiesLoading,
    hasProjects: $hasProjects,
  })

  const showSkeletons = activitiesLoading || hasProjects

  useEffect(() => {
    fetchActivitiesEvent()
  }, [fetchActivitiesEvent])

  return (
    <>
      <Helmet
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

                {showSkeletons && (
                  <Badge size={'2'} color={'gray'}>
                    <Text weight={'medium'} size={'1'}>
                      {t('dashboard.page.projectsCount', { count: 4 })}
                    </Text>
                  </Badge>
                )}
              </Flex>

              {showSkeletons ? (
                <Flex mb={{ initial: '3', sm: '0' }}>
                  <Search radius={isDesktop ? 'large' : undefined} size={'3'} />
                </Flex>
              ) : (
                <S.TopRight>
                  <Button
                    themeVariant="primary"
                    onClick={() => setCreateProjectOpen(true)}
                  >
                    <PlusIcon />

                    <Text>{t('dashboard.page.createProject')}</Text>
                  </Button>
                </S.TopRight>
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
            imageSrc="/img/photo/help.svg"
            title={t('dashboard.page.empty.title')}
            description={t('dashboard.page.empty.description')}
            actionLabel={t('dashboard.page.empty.action')}
          />
        )}
      </Wrapper>
    </>
  )
}
