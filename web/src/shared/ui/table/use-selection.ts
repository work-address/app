import { useMemo } from 'react'

import type { AnyRecord, DataProps, NonNullableSelectionProps } from './types'

type UseSelectionProps<T extends AnyRecord> = Pick<
  DataProps<T>,
  'getRowId' | 'data'
> &
  Partial<
    Pick<NonNullableSelectionProps, 'selectedIds' | 'onSelectedIdsChange'>
  >

export const useSelection = <T extends AnyRecord>({
  selectedIds,
  onSelectedIdsChange,
  getRowId,
  data,
}: UseSelectionProps<T>) => {
  const normalizedSelectedIds = useMemo(
    () => Object.entries(selectedIds || {}).filter(([_, value]) => value),
    [selectedIds],
  )

  const isPartiallySelected = useMemo(
    () =>
      normalizedSelectedIds.length > 0 &&
      normalizedSelectedIds.length < data.length,
    [normalizedSelectedIds, data],
  )

  const isAllSelected = useMemo(
    () => data.length > 0 && normalizedSelectedIds.length === data.length,
    [normalizedSelectedIds, data],
  )

  const handleSelectedChange = (id: string) => {
    const newSelected = { ...selectedIds, [id]: !selectedIds?.[id] }
    onSelectedIdsChange?.(newSelected)
  }

  const handleToggleAllSelected = () => {
    const allChecked = normalizedSelectedIds.length === 0

    const newSelectedIds = data.reduce(
      (acc, row) => {
        if (allChecked) {
          acc[getRowId(row)] = allChecked
        }

        return acc
      },
      {} as Record<string, boolean>,
    )

    onSelectedIdsChange?.(newSelectedIds)
  }

  return {
    isAllSelected,
    isPartiallySelected,
    handleSelectedChange,
    handleToggleAllSelected,
  }
}
