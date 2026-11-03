/** What a reader is on a project: the API's ProjectAccess.role, or the mock's. */
export type ReaderRole = 'owner' | 'worker' | 'viewer' | null

export type RoleOf<T> = (project: T) => ReaderRole

const works = (role: ReaderRole) => role === 'owner' || role === 'worker'

/**
 * "All projects", narrowed to the ones the people filter can apply to, so an
 * owner who also works on someone else's project can still filter by their
 * workers instead of being refused.
 */
export function projectsForPeople<T>(
  projects: T[],
  roleOf: RoleOf<T>,
  meId: string,
  userIds?: string[],
): T[] {
  if (!userIds?.length) return projects
  const onlySelf = userIds.every((id) => id === meId)
  return projects.filter(
    (project) =>
      roleOf(project) === 'owner' || (onlySelf && works(roleOf(project))),
  )
}

/** Whether these projects may not be read with this query's filters. */
export function refusesQuery<T>(
  projects: T[],
  roleOf: RoleOf<T>,
  meId: string,
  query: { userIds?: string[]; invoiceId?: string },
): boolean {
  const notOwned = projects.some((project) => roleOf(project) !== 'owner')
  const someViewed = projects.some((project) => !works(roleOf(project)))

  return Boolean(
    (query.userIds?.length &&
      notOwned &&
      (someViewed || query.userIds.some((id) => id !== meId))) ||
    (query.invoiceId && someViewed),
  )
}

/** Whether a report may not be read with these roles across its projects. */
export function refusesReport(kind: string, roles: ReaderRole[]): boolean {
  if (kind === 'workers') return roles.some((role) => role !== 'owner')
  if (kind === 'titles') return roles.some((role) => !works(role))
  return false
}
