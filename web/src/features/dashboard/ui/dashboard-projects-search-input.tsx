import { useStoreMap, useUnit } from 'effector-react'
import { useEffect, useState } from 'react'
import { useDebounce } from 'react-use'
import styled from 'styled-components'

import {
  $projectStateFilter,
  changeProjectStateFilter,
  setProjectsStateFiltering,
} from '@/entities/projects'
import { SearchInput } from '@/shared'

const SEARCH_DEBOUNCE_TIME = 1000

export const DashboardProjectsSearchInput = () => {
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

  return <Root value={searchText} onChange={handleChange} />
}

/* The shared field look and type size come from the workspace styles. */
const Root = styled(SearchInput)``
