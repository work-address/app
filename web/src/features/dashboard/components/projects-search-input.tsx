import { useStoreMap, useUnit } from 'effector-react'
import { useEffect, useState } from 'react'
import { useDebounce } from 'react-use'

import {
  $activityStateFilter,
  changeActivityStateFilter,
  setActivitiesStateFiltering,
} from '@/entities/activities'
import { useBreakpoint } from '@/shared'
import { SearchInput } from '@/shared'

const SEARCH_DEBOUNCE_TIME = 1000

export const ProjectsSearchInput = () => {
  const isDesktop = useBreakpoint('isDesktop')

  const searchTextFromStore = useStoreMap({
    store: $activityStateFilter,
    keys: [],
    fn: (state) => state.containsText,
  })

  const [searchText, setSearchText] = useState(searchTextFromStore)

  const { changeActivityStateFilterEvent, setActivitiesStateFilteringEvent } =
    useUnit({
      changeActivityStateFilterEvent: changeActivityStateFilter,
      setActivitiesStateFilteringEvent: setActivitiesStateFiltering,
    })

  useDebounce(
    () => {
      changeActivityStateFilterEvent({ containsText: searchText })
    },
    SEARCH_DEBOUNCE_TIME,
    [searchText],
  )

  const handleChange = (title: string) => {
    setActivitiesStateFilteringEvent(true)
    setSearchText(title)
  }

  useEffect(() => {
    setSearchText(searchTextFromStore)
  }, [searchTextFromStore])

  return (
    <SearchInput
      value={searchText}
      onChange={handleChange}
      radius={isDesktop ? 'large' : undefined}
      size={'3'}
    />
  )
}
