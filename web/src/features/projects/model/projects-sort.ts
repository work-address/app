import type { ProjectWithStats } from '@/entities/projects'
import type { SortOrder } from '@/shared'

import { sortRowsBy } from '@/shared'

export type ProjectSortField =
  | 'createdAt'
  | 'title'
  | 'state'
  | 'rateHour'
  | 'timeTotal'
  | 'timeActive'

export type ProjectSort = Partial<Record<ProjectSortField, SortOrder>>

/**
 * Newest first, which is how the list has always opened. No desktop column
 * shows the start date, so no header claims this order until one is clicked.
 */
export const DEFAULT_PROJECT_SORT: ProjectSort = { createdAt: 'DESC' }

/**
 * What the sort picker offers. The start date is here so a phone can get back
 * to the order the list opened in.
 */
export const PROJECT_SORT_FIELDS: {
  field: ProjectSortField
  labelKey: string
}[] = [
  {
    field: 'createdAt',
    labelKey: 'dashboard.projectsTable.drawer.meta.createdAt',
  },
  { field: 'title', labelKey: 'dashboard.projectsTable.head.projectName' },
  { field: 'state', labelKey: 'dashboard.projectsTable.head.status' },
  {
    field: 'rateHour',
    labelKey: 'dashboard.projectsTable.drawer.meta.rateHour',
  },
  { field: 'timeTotal', labelKey: 'dashboard.projectsTable.head.timeTotal' },
  { field: 'timeActive', labelKey: 'dashboard.projectsTable.head.timeActive' },
]

const READERS: Record<
  ProjectSortField,
  (project: ProjectWithStats) => string | number | null | undefined
> = {
  createdAt: (project) => project.createdAt,
  title: (project) => project.title,
  state: (project) => project.state,
  rateHour: (project) => project.rateHour,
  timeTotal: (project) => project.minutes,
  timeActive: (project) => project.minutesActive,
}

const isSortField = (key: string): key is ProjectSortField => key in READERS

/**
 * The projects in the order asked for. Ties fall back to the title and then the
 * id, so equal rows do not trade places between renders.
 */
export const sortProjects = <T extends ProjectWithStats>(
  projects: readonly T[],
  sort: ProjectSort,
): T[] => {
  const [key, order] = Object.entries(sort)[0] ?? []

  return key && order && isSortField(key)
    ? sortRowsBy(
        projects,
        READERS[key],
        order,
        (project) => `${project.title ?? ''} ${project.id ?? ''}`,
      )
    : [...projects]
}
