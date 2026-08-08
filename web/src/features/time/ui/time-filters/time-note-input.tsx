import { useStoreMap, useUnit } from 'effector-react'
import { useTranslation } from 'react-i18next'

import { changeTimeFilters, $timeFilters } from '@/entities/time'
import { Input } from '@/shared'

export const TimeNoteInput = () => {
  const { t } = useTranslation()

  const value = useStoreMap({
    store: $timeFilters,
    keys: [],
    fn: (filters) => filters.note,
  })

  const { changeFiltersEvent } = useUnit({
    changeFiltersEvent: changeTimeFilters,
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
