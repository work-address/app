import type { ProjectWithStats } from '@/entities/projects'

import { SERIES_COLORS, seriesColor, type BucketSeries } from '@/shared'

export const OTHER_SERIES_KEY = '__other'

/** One slot is kept back for "Other", so it always has its own colour. */
const NAMED_SLOTS = SERIES_COLORS.length - 1

/**
 * The series a chart of projects draws. The period's busiest projects get a
 * colour each - assigned by creation order, so the order in the legend and
 * the colours are the same whichever project is busiest - and the rest share
 * "Other". An account with dozens of projects still shows the ones that
 * worked, rather than whichever were created first.
 */
export function projectSeries(
  projects: ProjectWithStats[],
  totals: Map<string, number>,
  otherLabel: string,
): { keyOf: (projectId: string) => string; series: BucketSeries[] } {
  const busiest = [...totals]
    .filter(([, total]) => total > 0)
    .sort((a, b) => b[1] - a[1])
  const fits = busiest.length <= NAMED_SLOTS + 1
  const named = new Set(
    busiest.slice(0, fits ? busiest.length : NAMED_SLOTS).map(([id]) => id),
  )
  const ordered = projects
    .filter((project) => named.has(project.id ?? ''))
    .sort(
      (a, b) =>
        (a.createdAt ?? '').localeCompare(b.createdAt ?? '') ||
        (a.id ?? '').localeCompare(b.id ?? ''),
    )
  const series: BucketSeries[] = ordered.map((project, index) => ({
    key: project.id ?? '',
    label: project.title,
    color: seriesColor(index),
  }))
  const hasOther = busiest.some(([id]) => !named.has(id))

  return {
    keyOf: (projectId) => (named.has(projectId) ? projectId : OTHER_SERIES_KEY),
    series: hasOther
      ? [
          ...series,
          { key: OTHER_SERIES_KEY, label: otherLabel, color: seriesColor(-1) },
        ]
      : series,
  }
}
