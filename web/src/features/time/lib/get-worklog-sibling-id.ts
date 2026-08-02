import type { Time } from '@/entities/time'

type SiblingDirection = -1 | 1

export const getWorklogSiblingId = (
  worklogs: Time[],
  currentId: string | null,
  direction: SiblingDirection,
): string | null => {
  if (!currentId) {
    return null
  }

  const currentIndex = worklogs.findIndex((row) => row.id === currentId)

  if (currentIndex < 0) {
    return null
  }

  const sibling = worklogs[currentIndex + direction]

  return sibling?.id ?? null
}

export const getWorklogNavigationState = (
  worklogs: Time[],
  currentId: string | null,
) => {
  const currentIndex = worklogs.findIndex((row) => row.id === currentId)

  return {
    hasPrev: currentIndex > 0,
    hasNext: currentIndex >= 0 && currentIndex < worklogs.length - 1,
  }
}
