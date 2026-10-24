import { useUnit } from 'effector-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { fetchProjects } from '@/entities/projects'
import { TimeWorklogs, useTimeSearchSync } from '@/features/time'
import { PageHelmet, Wrapper } from '@/shared'

export default function TimePage() {
  const { t } = useTranslation()
  const fetchProjectsEvent = useUnit(fetchProjects)

  useTimeSearchSync()

  // The project filter and the entries' rates both come from the projects.
  useEffect(() => {
    fetchProjectsEvent()
  }, [fetchProjectsEvent])

  return (
    <Wrapper>
      <PageHelmet
        title={t('time.page.title')}
        description={t('time.page.meta')}
        noindex
      />
      <TimeWorklogs />
    </Wrapper>
  )
}
