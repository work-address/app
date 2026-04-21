import { PlusIcon } from '@radix-ui/react-icons'
import { Badge, Flex } from '@radix-ui/themes'
import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useTranslation } from 'react-i18next'
import { useMediaQuery } from 'styled-breakpoints/use-media-query'
import { useTheme } from 'styled-components'

import {
  ApplicationsUsage,
  DashboardEmptyState,
  WorklogsTable,
  ProjectsTable,
  CreateProjectModal,
  DashboardStyles as S,
  Search,
} from '@/features/dashboard'
import { Button, Text, Wrapper, Spinner, worklogsMock } from '@/features/shared'

const INIT_DELAY = 700

export default function DashboardPage() {
  const { breakpoints } = useTheme()
  const isUpMd = useMediaQuery(breakpoints.up('md'))

  const { t, i18n } = useTranslation()

  const [createProjectOpen, setCreateProjectOpen] = useState(false)
  const [initialized, setInitialized] = useState(false)

  const hasProjects = true

  useEffect(() => {
    setTimeout(() => {
      setInitialized(true)
    }, INIT_DELAY)
  }, [])

  return (
    <>
      <Helmet
        htmlAttributes={{ lang: i18n.language }}
        title={t('dashboard.page.title')}
      />

      {initialized ? (
        <Wrapper>
          <S.Content>
            <S.Left>
              <S.Top>
                <S.TitleRow>
                  <Flex align={'center'} gap={'10px'}>
                    <Text size={isUpMd ? '6' : '4'} weight={'medium'}>
                      {t('dashboard.page.title')}
                    </Text>

                    {hasProjects && !isUpMd && (
                      <Badge size={'2'} color={'gray'}>
                        <Text weight={'medium'} size={'1'}>
                          {t('dashboard.page.projectsCount', { count: 4 })}
                        </Text>
                      </Badge>
                    )}
                  </Flex>

                  {hasProjects ? (
                    <>{isUpMd && <Search />}</>
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
                </S.TitleRow>
              </S.Top>

              {hasProjects && (
                <S.TableArea>
                  <ProjectsTable />
                </S.TableArea>
              )}
            </S.Left>

            {hasProjects && (
              <S.Right>
                <ApplicationsUsage />
              </S.Right>
            )}
          </S.Content>

          <CreateProjectModal
            open={createProjectOpen}
            onOpenChange={setCreateProjectOpen}
          />

          {hasProjects && <WorklogsTable rows={worklogsMock} />}

          {!hasProjects && (
            <DashboardEmptyState
              imageSrc="/img/photo/help.svg"
              title={t('dashboard.page.empty.title')}
              description={t('dashboard.page.empty.description')}
              actionLabel={t('dashboard.page.empty.action')}
            />
          )}
        </Wrapper>
      ) : (
        <Flex justify={'center'} align="center" height={'80vh'}>
          <Spinner size={100} />
        </Flex>
      )}
    </>
  )
}
