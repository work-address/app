import { useStoreMap, useUnit } from 'effector-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { changeTimeFilters, $timeFilters } from '@/entities/time'
import { DatePickerInput } from '@/shared'

export const TimeDateRangePicker = () => {
  const { t } = useTranslation()

  const { changeFiltersEvent } = useUnit({
    changeFiltersEvent: changeTimeFilters,
  })

  const { fromAt, toAt } = useStoreMap({
    store: $timeFilters,
    keys: [],
    fn: (filters) => ({ fromAt: filters.fromAt, toAt: filters.toAt }),
  })

  const from = useMemo(() => (fromAt ? new Date(fromAt) : null), [fromAt])
  const to = useMemo(() => (toAt ? new Date(toAt) : null), [toAt])

  return (
    <>
      <DatePickerInput
        id={'fromAt'}
        value={from}
        onChange={(date) => changeFiltersEvent({ fromAt: date?.getTime() })}
        placeholder={t('dashboard.page.filters.from')}
      />
      <DatePickerInput
        id={'toAt'}
        value={to}
        onChange={(date) => changeFiltersEvent({ toAt: date?.getTime() })}
        placeholder={t('dashboard.page.filters.to')}
      />
    </>
  )
}
