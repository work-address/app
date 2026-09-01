import { useStoreMap, useUnit } from 'effector-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { $projects } from '@/entities/projects'
import { changeTimeFilters, $timeFilters } from '@/entities/time'
import { Select } from '@/shared'

export const TimeProjectsSelect = () => {
  const { t } = useTranslation()

  const selectedActivity = useStoreMap({
    store: $timeFilters,
    keys: [],
    fn: (filters) => filters.activityId,
  })

  const { changeFiltersEvent, projects } = useUnit({
    changeFiltersEvent: changeTimeFilters,
    projects: $projects,
  })

  const options = useMemo(
    () =>
      projects.map((project) => ({
        value: project.id ?? '',
        label: project.title,
      })),
    [projects],
  )

  return (
    <Select
      label={t('dashboard.page.filters.projects')}
      options={options}
      value={selectedActivity ?? ''}
      onChange={(v) => {
        if (!Array.isArray(v)) {
          changeFiltersEvent({ activityId: v })
        }
      }}
      allSelectedText={t('dashboard.page.filters.allWorklogs')}
      placeholder={'Select projects'}
    />
  )
}
