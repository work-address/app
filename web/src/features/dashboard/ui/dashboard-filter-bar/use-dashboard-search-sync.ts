import { useUnit } from 'effector-react'
import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

import {
  $dashboardFilters,
  dashboardFiltersRestored,
  parseDashboardSearch,
  toDashboardSearch,
} from '../../model'

/**
 * Keeps the dashboard's period, projects and people in its URL, so a reload
 * or a shared link shows the same figures. Read once on arrival; afterwards
 * the stores lead and the URL follows.
 */
export const useDashboardSearchSync = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const restore = useUnit(dashboardFiltersRestored)

  useEffect(() => {
    const subscription = $dashboardFilters.updates.watch((filters) => {
      setSearchParams(toDashboardSearch(filters), { replace: true })
    })

    return () => subscription.unsubscribe()
  }, [setSearchParams])

  useEffect(() => {
    restore(parseDashboardSearch(searchParams))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- arrival only
  }, [])
}
