import { useUnit } from 'effector-react'
import { useMemo } from 'react'
import styled from 'styled-components'

import {
  $timeSelection,
  groupTimeByDay,
  timeRowClicked,
  timeSelectionChanged,
} from '../../model'

import { TimeGridDay } from './time-grid-day'
import { TimeGridSkeleton } from './time-grid-skeleton'

import {
  $allTime,
  $isLoadingMoreTime,
  $isTimeFiltering,
  $timeLoading,
  loadMoreTime,
} from '@/entities/time'
import { Spinner, useReachEnd } from '@/shared'

export const TimeGrid = () => {
  const {
    entries,
    loading,
    isFiltering,
    isLoadingMore,
    loadMore,
    selection,
    changeSelection,
    openEntry,
  } = useUnit({
    entries: $allTime,
    loading: $timeLoading,
    isFiltering: $isTimeFiltering,
    isLoadingMore: $isLoadingMoreTime,
    loadMore: loadMoreTime,
    selection: $timeSelection,
    changeSelection: timeSelectionChanged,
    openEntry: timeRowClicked,
  })

  const groups = useMemo(() => groupTimeByDay(entries), [entries])

  const sentinelRef = useReachEnd({
    onReachEnd: loadMore,
    resetKey: entries.length,
  })

  const handleSelectedChange = (id: string) =>
    changeSelection({ ...selection, [id]: !selection[id] })

  if (loading && entries.length === 0) {
    return <TimeGridSkeleton />
  }

  return (
    <Root data-filtering={isFiltering || undefined}>
      {groups.map((group) => (
        <TimeGridDay
          key={group.day}
          group={group}
          selectedIds={selection}
          onOpen={openEntry}
          onSelectedChange={handleSelectedChange}
        />
      ))}
      {isLoadingMore && (
        <Footer>
          <Spinner size={32} />
        </Footer>
      )}
      <Sentinel ref={sentinelRef} />
    </Root>
  )
}

const Root = styled.div`
  display: grid;
  gap: var(--space-6);

  &[data-filtering] {
    opacity: 0.6;
    pointer-events: none;
  }
`

const Footer = styled.div`
  display: grid;
  place-items: center;
  padding: var(--space-6) 0;
`

const Sentinel = styled.div`
  height: 1px;
`
