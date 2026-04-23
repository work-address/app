import { createContext } from 'react'

import type { ProjectWithStats } from '@/entities/activities'
import type { useTranslation } from 'react-i18next'

export type ProjectTableContextValues = {
  handleActionClick: (
    row: ProjectWithStats,
    action: 'Edit' | 'Print' | 'Delete',
  ) => void
  t: ReturnType<typeof useTranslation>['t']
}

const values: ProjectTableContextValues = {
  handleActionClick: () => void 0,
  t: (() => '') as ReturnType<typeof useTranslation>['t'],
}

export const ProjectsTableContext = createContext(values)
