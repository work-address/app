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

const Root = styled(SearchInput)`
  --text-field-height: var(--ui-control-height);
  --text-field-border-radius: var(--ui-icon-radius);
  --color-surface: var(--ui-surface);
  --gray-a7: var(--ui-line);
  --gray-a10: var(--ui-muted);
  --gray-a11: var(--ui-muted);
  --gray-12: var(--ui-text);

  font-size: var(--ui-meta-size);

  ${(p) => p.theme.breakpoints.down('md')} {
    font-size: var(--ui-body-size);
  }
`
