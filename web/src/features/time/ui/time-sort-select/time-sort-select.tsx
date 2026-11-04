import { useUnit } from 'effector-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import {
  getTimeSortField,
  getTimeSortOrder,
  TIME_SORT_FIELDS,
  toTimeSort,
} from '../../model'

import { $timeSort, resetTimeSort } from '@/entities/time'
import { SortSelect } from '@/shared'

/**
 * The feed's sort picker. Writes the same store the table headers do, so the
 * order survives a view switch.
 */
export const TimeSortSelect = ({ className }: { className?: string }) => {
  const { t } = useTranslation()

  const { sort, setSort } = useUnit({
    sort: $timeSort,
    setSort: resetTimeSort,
  })

  const options = useMemo(
    () =>
      TIME_SORT_FIELDS.map((entry) => ({
        value: entry.field,
        label: t(entry.labelKey),
      })),
    [t],
  )

  return (
    <SortSelect
      className={className}
      options={options}
      field={getTimeSortField(sort)}
      order={getTimeSortOrder(sort)}
      onChange={(field, order) => setSort(toTimeSort(field, order))}
    />
  )
}
