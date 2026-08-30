import type { CollaboratorFormRow } from '.'

import { getFriendlyWalletAddress } from '@/shared'

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
/**
 * Read side. Addresses are shown in the form a wallet displays - TON stores the
 * raw `0:4a5d…` spelling, which no wallet ever shows and nobody recognises.
 *
 * Safe to convert here because the API now canonicalises collaborator addresses
 * on write (WalletAddress.toStorage), so a friendly string round-tripping back
 * through mapCollaboratorsToAddresses resolves to the same account.
 */
export const mapAddressesToCollaborators = (
  workerAddresses?: string[] | null,
  viewerAddresses?: string[] | null,
): CollaboratorFormRow[] => [
  ...(workerAddresses ?? []).map((address) => ({
    address: getFriendlyWalletAddress(address) ?? address,
    role: 'Worker' as const,
  })),
  ...(viewerAddresses ?? []).map((address) => ({
    address: getFriendlyWalletAddress(address) ?? address,
    role: 'Viewer' as const,
  })),
]
