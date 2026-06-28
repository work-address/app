import { useStoreMap, useUnit } from 'effector-react'
import { useEffect, useState } from 'react'
import { useDebounce } from 'react-use'

import {
  $projectStateFilter,
  changeProjectStateFilter,
  setProjectsStateFiltering,
} from '@/entities/projects'
import { useBreakpoint } from '@/shared'
import { SearchInput } from '@/shared'

const SEARCH_DEBOUNCE_TIME = 1000

export const ProjectsSearchInput = () => {
  const isDesktop = useBreakpoint('isDesktop')

  const searchTextFromStore = useStoreMap({
    store: $projectStateFilter,
    keys: [],
    fn: (state) => state.containsText,
  })

  const [searchText, setSearchText] = useState(searchTextFromStore)

  const { changeProjectStateFilterEvent, setProjectsStateFilteringEvent } =
    useUnit({
      changeProjectStateFilterEvent: changeProjectStateFilter,
      setProjectsStateFilteringEvent: setProjectsStateFiltering,
    })

  useDebounce(
    () => {
      changeProjectStateFilterEvent({ containsText: searchText })
    },
    SEARCH_DEBOUNCE_TIME,
    [searchText],
  )

  const handleChange = (title: string) => {
    setProjectsStateFilteringEvent(true)
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
