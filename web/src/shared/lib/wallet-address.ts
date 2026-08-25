/**
 * Wallet-address predicates shared across features. These sat in
 * features/projects because collaborators were the first caller, but nothing
 * about them is project-specific - shared/lib/formatters already owns the
 * display side of the same concept.
 */

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

/** Case-insensitive address equality, the check both API and UI rely on. */
export const isSameWalletAddress = (a: string, b: string): boolean =>
  normalizeAddress(a) === normalizeAddress(b)
