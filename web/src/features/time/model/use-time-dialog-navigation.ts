import { useCallback, useEffect, useMemo, useRef } from 'react'

import { getTimeNavigationState, getTimeSiblingId } from './get-time-sibling-id'

import type { Time } from '@/entities/time'

const PREFETCH_REMAINING_ITEMS = 2

type UseTimeDialogNavigationParams = {
  timeEntries: Time[]
  selectedTimeId: string | null
  isOpen: boolean
  hasMore: boolean
  isLoadingMore: boolean
  onLoadMore: () => void
  onSelect: (id: string) => void
}

export const useTimeDialogNavigation = ({
  timeEntries,
  selectedTimeId,
  isOpen,
  hasMore,
  isLoadingMore,
  onLoadMore,
  onSelect,
}: UseTimeDialogNavigationParams) => {
  const pendingNextRef = useRef(false)

  const { hasPrev, hasNext } = useMemo(
    () => getTimeNavigationState(timeEntries, selectedTimeId, hasMore),
    [timeEntries, selectedTimeId, hasMore],
  )

  const goToSibling = useCallback(
    (direction: -1 | 1) => {
      const siblingId = getTimeSiblingId(timeEntries, selectedTimeId, direction)

      if (siblingId) {
        pendingNextRef.current = false
        onSelect(siblingId)
        return
      }

      if (direction !== 1 || !hasMore) {
        return
      }

      pendingNextRef.current = true

      if (!isLoadingMore) {
        onLoadMore()
      }
    },
    [hasMore, isLoadingMore, onLoadMore, onSelect, selectedTimeId, timeEntries],
  )

  const handlePrev = useCallback(() => {
    goToSibling(-1)
  }, [goToSibling])

  const handleNext = useCallback(() => {
    goToSibling(1)
  }, [goToSibling])

  useEffect(() => {
    if (!isOpen || !selectedTimeId || !hasMore || isLoadingMore) {
      return
    }

    const currentIndex = timeEntries.findIndex(
      (row) => row.id === selectedTimeId,
    )

    if (currentIndex < 0) {
      return
    }

    const remaining = timeEntries.length - 1 - currentIndex

    if (remaining <= PREFETCH_REMAINING_ITEMS) {
      onLoadMore()
    }
  }, [hasMore, isLoadingMore, isOpen, onLoadMore, selectedTimeId, timeEntries])

  useEffect(() => {
    if (!pendingNextRef.current) {
      return
    }

    const siblingId = getTimeSiblingId(timeEntries, selectedTimeId, 1)

    if (siblingId) {
      pendingNextRef.current = false
      onSelect(siblingId)
      return
    }

    if (!isLoadingMore && !hasMore) {
      pendingNextRef.current = false
    }
  }, [hasMore, isLoadingMore, onSelect, selectedTimeId, timeEntries])

  useEffect(() => {
    if (!isOpen) {
      pendingNextRef.current = false
    }
  }, [isOpen])

  return {
    hasPrev,
    hasNext,
    onPrev: handlePrev,
    onNext: handleNext,
  }
}
