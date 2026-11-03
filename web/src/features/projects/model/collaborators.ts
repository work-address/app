import type { CollaboratorFormRow } from '.'

export const mapCollaboratorsToAddresses = (
  collaborators: CollaboratorFormRow[],
) => {
  const workerAddresses: string[] = []
  const viewerAddresses: string[] = []

  for (const row of collaborators) {
    const address = row.address.trim()
    if (!address) {
      continue
    }

    if (row.role === 'Worker') {
      workerAddresses.push(address)
    } else {
      viewerAddresses.push(address)
    }
  }

  return { workerAddresses, viewerAddresses }
}

/** Builds collaborator form rows from a project's address fields. */
export const mapAddressesToCollaborators = (
  workerAddresses?: string[] | null,
  viewerAddresses?: string[] | null,
): CollaboratorFormRow[] => [
  ...(workerAddresses ?? []).map((address) => ({
    address,
    role: 'Worker' as const,
  })),
  ...(viewerAddresses ?? []).map((address) => ({
    address,
    role: 'Viewer' as const,
  })),
]
