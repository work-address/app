import { attach, combine, createEvent, createStore, sample } from 'effector'

import {
  $filteredProjects,
  changeProjectStateFilter,
  deleteProjectMutation,
  type ProjectsFilter,
  type ProjectWithStats,
} from '@/entities/projects'
import { confirmFx, showToastFx, translate } from '@/shared'

/**
 * Session state for the projects table. Selection and the two dialogs are
 * shared between the desktop and mobile trees, and the reaction to a delete
 * landing is a consequence of the mutation finishing, not of a render.
 */

export const projectSelectionChanged = createEvent<Record<string, boolean>>()
export const projectSelectionCleared = createEvent()
export const projectStateTabChanged =
  createEvent<ProjectsFilter['projectState']>()
export const projectEditRequested = createEvent<ProjectWithStats>()
export const projectDeleteRequested = createEvent<ProjectWithStats>()
export const projectDialogOpenChanged = createEvent<boolean>()
export const projectCreateDialogOpenChanged = createEvent<boolean>()

export const $projectSelection = createStore<Record<string, boolean>>({})
  .on(projectSelectionChanged, (_, selection) => selection)
  .reset(projectSelectionCleared, projectStateTabChanged)

export const $selectedProject = createStore<ProjectWithStats | null>(null).on(
  projectEditRequested,
  (_, row) => row,
)

export const $isProjectDialogOpen = createStore(false)
  .on(projectEditRequested, () => true)
  .on(projectDialogOpenChanged, (_, open) => open)

export const $isProjectCreateDialogOpen = createStore(false).on(
  projectCreateDialogOpenChanged,
  (_, open) => open,
)

/** Enabled only when the selection covers every row currently listed. */
export const $canDeleteAllProjects = combine(
  $projectSelection,
  $filteredProjects,
  (selection, projects) => {
    const selected = Object.values(selection)

    return (
      selected.length > 0 &&
      projects.length === selected.length &&
      selected.every(Boolean)
    )
  },
)

sample({
  clock: projectStateTabChanged,
  fn: (projectState) => ({ projectState, containsText: '' }),
  target: changeProjectStateFilter,
})

// --- Delete -----------------------------------------------------------------

/** Attached so `.done` belongs to this flow rather than every app confirm. */
const confirmDeleteProjectFx = attach({ effect: confirmFx })

const $pendingDeleteId = createStore<string | null>(null)
  .on(projectDeleteRequested, (_, row) => row.id ?? null)
  .reset(confirmDeleteProjectFx.finally)

sample({
  clock: projectDeleteRequested,
  filter: (row) => Boolean(row.id),
  fn: () => ({
    title: translate('dashboard.projectsTable.confirmDelete.title'),
    description: translate('dashboard.projectsTable.confirmDelete.description'),
    confirmLabel: translate('dashboard.projectsTable.confirmDelete.confirm'),
  }),
  target: confirmDeleteProjectFx,
})

sample({
  clock: confirmDeleteProjectFx.done,
  source: $pendingDeleteId,
  filter: (id): id is string => id !== null,
  fn: (id: string) => id,
  target: deleteProjectMutation.start,
})

sample({
  clock: deleteProjectMutation.finished.success,
  target: [deleteProjectMutation.reset, projectSelectionCleared],
})

sample({
  clock: deleteProjectMutation.finished.success,
  fn: () => false,
  target: projectDialogOpenChanged,
})

sample({
  clock: deleteProjectMutation.finished.success,
  fn: () => ({
    type: 'error' as const,
    messageKey: 'dashboard.projectsTable.deletedMessage',
  }),
  target: showToastFx,
})
