export type TimeBulkAction =
  | 'paid'
  | 'unpaid'
  | 'invoice'
  | 'delete'
  | 'remove-screenshots'
  | 'remove-processes'

/** Every selected row must be known and belong to the same project. */
export function getSelectedTimeProjectId(
  rows: { id?: string; project?: { id?: string } | null }[],
  ids: string[],
): string | null {
  if (ids.length === 0) {
    return null
  }
  const rowsById = new Map(rows.map((row) => [row.id, row]))
  const projects = new Set<string>()

  for (const id of ids) {
    const projectId = rowsById.get(id)?.project?.id
    if (!projectId) {
      return null
    }
    projects.add(projectId)
  }

  return projects.size === 1 ? [...projects][0]! : null
}

export function isSameTimeSelection(a: string[], b: string[]): boolean {
  const ids = new Set(a)
  return ids.size === b.length && b.every((id) => ids.has(id))
}
