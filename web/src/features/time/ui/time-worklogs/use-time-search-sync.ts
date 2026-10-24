import { useUnit } from 'effector-react'
import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

import { parseTimeSearch, toTimeSearch } from '../../model/time-url'

import { fetchTime, restoreTimeQuery, timeQuery } from '@/entities/time'

/**
 * Keeps the worklog filters and sort in the page's URL, so a reload or a
 * shared link opens the same entries.
 *
 * The URL follows the first page of each search rather than the filter store:
 * on a phone the filters are drafts until applied, and a URL that changed
 * with every keystroke would describe entries nobody has seen. Only the first
 * page counts because the feed scrolls; later pages are not a place to link to.
 */
export const useTimeSearchSync = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const { restore, fetch } = useUnit({
    restore: restoreTimeQuery,
    fetch: fetchTime,
  })

  useEffect(() => {
    const subscription = timeQuery.start.watch((params) => {
      if ((params.page ?? 0) !== 0) {
        return
      }

      setSearchParams(toTimeSearch(params, params.sort ?? {}), {
        replace: true,
      })
    })

    return () => subscription.unsubscribe()
  }, [setSearchParams])

  // Read once on arrival. Afterwards the stores lead and the URL follows.
  useEffect(() => {
    restore(parseTimeSearch(searchParams))
    fetch()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- arrival only
  }, [])
}
