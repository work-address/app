import { createContext } from 'react'

import type { ProjectWithStats } from '@/entities/projects'
import type { useTranslation } from 'react-i18next'

export type ProjectsTableContextValues = {
  handleActionClick: (row: ProjectWithStats, action: 'Edit' | 'Delete') => void
  t: ReturnType<typeof useTranslation>['t']
}

const values: ProjectsTableContextValues = {
  handleActionClick: () => void 0,
  t: (() => '') as ReturnType<typeof useTranslation>['t'],
}

export const ProjectsTableContext = createContext(values)
