import type { CollaboratorFormRow } from './types'

/** EVM address, e.g. 0x-prefixed 40 hex chars. */
const EVM_ADDRESS = /^0x[\dA-Fa-f]{40}$/
/** TON user-friendly address (EQ/UQ/kQ/0Q + 46 base64url chars). */
const TON_FRIENDLY_ADDRESS = /^[0EKUk][Qq][\w-]{46}$/
/** TON raw address, e.g. 0:hex. */
const TON_RAW_ADDRESS = /^-?\d+:[\dA-Fa-f]{64}$/
/** Solana address is base58, typically 32-44 chars. */
const SOLANA_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/

/** Returns true when the value looks like an EVM, TON or Solana address. */
export const isValidWalletAddress = (value: string): boolean => {
  const address = value.trim()

  return (
    EVM_ADDRESS.test(address) ||
    TON_FRIENDLY_ADDRESS.test(address) ||
    TON_RAW_ADDRESS.test(address) ||
    SOLANA_ADDRESS.test(address)
  )
}

/** Normalizes an address for equality checks (trim + lowercase). */
export const normalizeAddress = (address: string): string =>
  address.trim().toLowerCase()

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
