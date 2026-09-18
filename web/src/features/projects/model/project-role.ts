import type { baseApi } from '@/shared'

// Past the `@/shared` barrel on purpose: it also loads the wallet providers,
// which read `window` on import, and this module is unit-tested under node.
import { isSameWalletAddress } from '@/shared/lib/wallet-address'

/**
 * What the role check reads off a project. `user` is the owner: the API sends
 * it with every project it lists, although the generated type leaves it out.
 */
export type ProjectMembership = Pick<
  baseApi.Project,
  'workerAddresses' | 'viewerAddresses'
> & {
  user?: { id?: string } | null
}

/** The signed-in account, as far as the role check needs it. */
export type ProjectMember = Pick<baseApi.User, 'id' | 'address'>

/**
 * Whether `member` sees this project only as a viewer.
 *
 * A viewer watches progress but has no part in the money: the API refuses
 * them an invoice and shows them none, so the Invoice action would lead
 * nowhere. Mirrors Project.isWorker on the API - the owner and anyone on the
 * worker list may invoice, whatever else they are listed as.
 *
 * Addresses match case-insensitively, as the API's access filters do. An
 * unknown member is never treated as a viewer: hiding an action the server
 * would allow is worse than showing one it refuses.
 */
export const isProjectViewerOnly = (
  project: ProjectMembership,
  member: ProjectMember | null | undefined,
): boolean => {
  const address = member?.address

  if (!address) {
    return false
  }

  if (member.id && project.user?.id === member.id) {
    return false
  }

  const listed = (addresses: string[] | undefined) =>
    (addresses ?? []).some((entry) => isSameWalletAddress(entry, address))

  return listed(project.viewerAddresses) && !listed(project.workerAddresses)
}

/**
 * The ids of the projects `member` only views - the ones that get no Invoice
 * action. Projects without an id are skipped: there is nothing to look up.
 */
export const getViewerOnlyProjectIds = (
  projects: readonly (ProjectMembership & { id?: string })[],
  member: ProjectMember | null | undefined,
): string[] =>
  projects.flatMap((project) =>
    project.id && isProjectViewerOnly(project, member) ? [project.id] : [],
  )
