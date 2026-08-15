import type { Time } from '@/entities/time'

type SiblingDirection = -1 | 1

export const getTimeSiblingId = (
  timeEntries: Time[],
  currentId: string | null,
  direction: SiblingDirection,
): string | null => {
  if (!currentId) {
    return null
  }

  const currentIndex = timeEntries.findIndex((row) => row.id === currentId)

  if (currentIndex < 0) {
    return null
  }

  const sibling = timeEntries[currentIndex + direction]

  return sibling?.id ?? null
}

export const getTimeNavigationState = (
  timeEntries: Time[],
  currentId: string | null,
  hasMore = false,
) => {
  const currentIndex = timeEntries.findIndex((row) => row.id === currentId)

  return {
    hasPrev: currentIndex > 0,
    hasNext:
      currentIndex >= 0 && (currentIndex < timeEntries.length - 1 || hasMore),
  }
}
