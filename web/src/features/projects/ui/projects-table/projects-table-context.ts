import { createContext } from 'react'

import type { ProjectWithStats } from '@/entities/projects'
import type { useTranslation } from 'react-i18next'

export type ProjectsTableContextValues = {
  handleActionClick: (row: ProjectWithStats, action: 'Edit' | 'Delete') => void
  /** False where the signed-in user only views the project. */
  canInvoice: (row: ProjectWithStats) => boolean
  t: ReturnType<typeof useTranslation>['t']
}

const values: ProjectsTableContextValues = {
  handleActionClick: () => void 0,
  canInvoice: () => true,
  t: (() => '') as ReturnType<typeof useTranslation>['t'],
}

export const ProjectsTableContext = createContext(values)
