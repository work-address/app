import { useCallback, useMemo, useState } from 'react'

type UseDataProcessingProps<T> = {
  data: T[]
}

type FilterState<T> = {
  value: T[keyof T]
  field: keyof T
  operator: FilterOperator
}

export const useDataProcessing = <T,>({ data }: UseDataProcessingProps<T>) => {
  const [filterState, setFilterState] = useState<FilterState<T>[]>([])

  const processSingleDataFilter = useCallback(
    (
      field: keyof T,
      value: T[keyof T],
      operator: FilterOperator = 'equals',
    ) => {
      setFilterState([{ field, value, operator }])
    },
    [],
  )

  const resetFilter = useCallback(() => {
    setFilterState([])
  }, [])

  const processedData = useMemo(() => {
    let filtered: T[] = [...data]
    const predicate = createPredicate(filterState)

    if (data.length > 0) {
      filtered = data.filter(predicate)
    }

    return filtered
  }, [data, filterState])

  return { processSingleDataFilter, resetFilter, processedData, filterState }
}

type FilterOperator = 'equals' | 'contains' | 'gt' | 'lt' | 'in' | 'between'

type FilterCriterion<T> = {
  field: keyof T
  operator: FilterOperator
  value: T[keyof T]
}

const createPredicate = <T,>(criteria: FilterCriterion<T>[]) => {
  return (item: T) => {
    return criteria.every((criterion) => {
      const { field, operator, value } = criterion
      const itemValue = item[field]

      switch (operator) {
        case 'equals': {
          return itemValue === value
        }
        case 'contains': {
          return String(itemValue)
            .toLowerCase()
            .includes(String(value).toLowerCase())
        }
        case 'gt': {
          return itemValue > value
        }
        case 'lt': {
          return itemValue < value
        }
        case 'in': {
          return Array.isArray(value) && value.includes(itemValue)
        }
        default: {
          return true
        }
      }
    })
  }
}
