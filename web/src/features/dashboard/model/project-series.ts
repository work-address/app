import type { ProjectWithStats } from '@/entities/projects'

import { SERIES_COLORS, seriesColor, type BucketSeries } from '@/shared'

export const OTHER_SERIES_KEY = '__other'

/**
 * A colour slot per project by creation order, so a project keeps its colour
 * whatever the filter or period. Past the last slot projects share "Other".
 */
export const projectSlots = (projects: ProjectWithStats[]) =>
  new Map(
    [...projects]
      .sort(
        (a, b) =>
          (a.createdAt ?? '').localeCompare(b.createdAt ?? '') ||
          (a.id ?? '').localeCompare(b.id ?? ''),
      )
      .map((project, index) => [project.id ?? '', index]),
  )

/** The series key a project's time is drawn under. */
export const projectSeriesKey = (
  slots: Map<string, number>,
  projectId: string,
) => {
  const slot = slots.get(projectId)

  return slot !== undefined && slot < SERIES_COLORS.length
    ? projectId
    : OTHER_SERIES_KEY
}

/** The series to draw for the projects that have time, in slot order. */
export const projectSeries = (
  projects: ProjectWithStats[],
  slots: Map<string, number>,
  withTime: Set<string>,
  otherLabel: string,
): BucketSeries[] => {
  const series = projects
    .filter((project) => withTime.has(project.id ?? ''))
    .map((project) => ({
      key: projectSeriesKey(slots, project.id ?? ''),
      label: project.title,
      color: seriesColor(slots.get(project.id ?? '') ?? -1),
      slot: slots.get(project.id ?? '') ?? Number.MAX_SAFE_INTEGER,
    }))
    .filter((s) => s.key !== OTHER_SERIES_KEY)
    .sort((a, b) => a.slot - b.slot)
    .map(({ key, label, color }) => ({ key, label, color }))

  const hasOther = [...withTime].some(
    (id) => projectSeriesKey(slots, id) === OTHER_SERIES_KEY,
  )

  return hasOther
    ? [
        ...series,
        { key: OTHER_SERIES_KEY, label: otherLabel, color: seriesColor(-1) },
      ]
    : series
}
