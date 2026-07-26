import { useStoreMap, useUnit } from 'effector-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { changeWorklogFilters, $worklogsFilters } from '@/entities/time'
import { DatePickerInput } from '@/shared'

export const DateRangePicker = () => {
  const { t } = useTranslation()

  const { changeFiltersEvent } = useUnit({
    changeFiltersEvent: changeWorklogFilters,
  })

  const { fromAt, toAt } = useStoreMap({
    store: $worklogsFilters,
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
