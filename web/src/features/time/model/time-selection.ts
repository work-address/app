import type { Time } from '@/entities/time'

type SelectedProject = NonNullable<Time['project']>

/**
 * The distinct projects the selected entries belong to, in the order first
 * met. Entries without a project, and selected ids no longer in the feed,
 * contribute nothing.
 */
export const getSelectedTimeProjects = (
  entries: Pick<Time, 'id' | 'project'>[],
  selectedIds: string[],
): SelectedProject[] => {
  const selected = new Set(selectedIds)
  const projects = new Map<string, SelectedProject>()

  for (const entry of entries) {
    const project = entry.project

    if (
      entry.id !== undefined &&
      selected.has(entry.id) &&
      project?.id &&
      !projects.has(project.id)
    ) {
      projects.set(project.id, project)
    }
  }

  return [...projects.values()]
}
