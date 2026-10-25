import { createContext } from 'react'

import type { ProjectWithStats } from '@/entities/projects'
import type { ReactNode } from 'react'
import type { useTranslation } from 'react-i18next'

export type ProjectsTableContextValues = {
  handleActionClick: (row: ProjectWithStats, action: 'Edit' | 'Delete') => void
  t: ReturnType<typeof useTranslation>['t']
  /** What hovering a project's name shows; nothing when not set. */
  projectPopup?: (row: ProjectWithStats) => ReactNode
}

const values: ProjectsTableContextValues = {
  handleActionClick: () => void 0,
  t: (() => '') as ReturnType<typeof useTranslation>['t'],
}

export const ProjectsTableContext = createContext(values)
