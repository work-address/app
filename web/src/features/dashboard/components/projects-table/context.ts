import { createContext } from 'react'

import type { ProjectWithStats } from '@/entities/activities'

export type ProjectTableContextValues = {
  handleActionClick: (
    row: ProjectWithStats,
    action: 'Edit' | 'Print' | 'Delete',
  ) => void
}

const values: ProjectTableContextValues = {
  handleActionClick: () => void 0,
}

export const ProjectsTableContext = createContext(values)
