import { useStoreMap, useUnit } from 'effector-react'
import { useTranslation } from 'react-i18next'

import { changeWorklogFilters, $worklogsFilters } from '@/entities/time'
import { Input } from '@/shared'

export const NoteInput = () => {
  const { t } = useTranslation()

  const value = useStoreMap({
    store: $worklogsFilters,
    keys: [],
    fn: (filters) => filters.note,
  })

  const { changeFiltersEvent } = useUnit({
    changeFiltersEvent: changeWorklogFilters,
  })

  return (
    <Input
      label={'Note'}
      id={'note'}
      value={value ?? ''}
      placeholder={t('dashboard.page.filters.searchNote')}
      onChange={(e) => changeFiltersEvent({ note: e.target.value })}
      columns="1fr"
      rows="auto auto"
      gap="2"
      textSize="3"
      textWeight="regular"
    />
  )
}
