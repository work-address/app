/**
 * Opening the dashboard on one project: `/?project=<id>`.
 *
 * The marketplace's contract card links here with the project its hire
 * opened, so "Track time" lands on the work it names instead of on a list
 * the person then has to search. Framework-free and pure, so the rule can be
 * unit-tested without a router or a store: the page reads the parameter,
 * asks what to do with it, and renders the answer.
 */

/** The query parameter the dashboard reads a project id from. */
export const FOCUSED_PROJECT_PARAM = 'project'

/** What the dashboard should do about the `project` parameter. */
export type FocusedProjectOutcome =
  /** No parameter: the ordinary dashboard, every project listed. */
  | { kind: 'none' }
  /** The project is this account's; the list is narrowed to it. */
  | { kind: 'focused'; projectId: string }
  /**
   * A project id this account cannot see - someone else's, deleted, or a
   * link followed while signed in as the wrong person. Deliberately not
   * distinguished from "does not exist": telling a stranger which ids are
   * real is how a list of projects gets enumerated.
   */
  | { kind: 'no-access'; projectId: string }

/** Whether the list has to wait for projects before it can answer. */
export type FocusedProjectInput = {
  /** The raw `?project=` value, or null when there is none. */
  param: string | null
  /** Ids of the projects this account can see; null while they load. */
  visibleProjectIds: string[] | null
}

/** The `?project=` value of a query string, trimmed, or null when absent. */
export const readFocusedProjectParam = (
  search: string | URLSearchParams,
): string | null => {
  const params =
    typeof search === 'string' ? new URLSearchParams(search) : search
  const value = params.get(FOCUSED_PROJECT_PARAM)?.trim() ?? ''

  return value.length > 0 ? value : null
}

/**
 * What to show for a `?project=` link.
 *
 * While the projects are still loading the answer is `focused`, not
 * `no-access`: the list is empty before it is fetched, and answering
 * "no access" then would flash a denial at the owner of the project on every
 * single visit.
 */
export const focusedProject = ({
  param,
  visibleProjectIds,
}: FocusedProjectInput): FocusedProjectOutcome => {
  if (!param) {
    return { kind: 'none' }
  }

  if (visibleProjectIds === null) {
    return { kind: 'focused', projectId: param }
  }

  return visibleProjectIds.includes(param)
    ? { kind: 'focused', projectId: param }
    : { kind: 'no-access', projectId: param }
}

/**
 * The projects the dashboard lists under this outcome.
 *
 * A focused link narrows the list to its one project; `no-access` shows
 * nothing at all rather than quietly falling back to the full list, which
 * would leave the person believing they were looking at the project they
 * clicked.
 */
export const narrowToFocusedProject = <T extends { id?: string | null }>(
  projects: T[],
  outcome: FocusedProjectOutcome,
): T[] => {
  if (outcome.kind === 'none') {
    return projects
  }

  if (outcome.kind === 'no-access') {
    return []
  }

  return projects.filter((project) => project.id === outcome.projectId)
}
