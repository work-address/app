import { createContext } from 'react'

import type { ProjectRow } from '@/features/dashboard'

export type ProjectTableContextValues = {
  handleActionClick: (
    row: ProjectRow,
    action: 'Edit' | 'Print' | 'Delete',
  ) => void
}

const values: ProjectTableContextValues = {
  handleActionClick: () => {},
}

export const ProjectsTableContext = createContext(values)
