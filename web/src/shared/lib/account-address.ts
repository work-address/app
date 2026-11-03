/**
 * Address predicates shared across features. An account's address is an EVM
 * address for a wallet account, or the Google email for a Google account.
 */

const EVM_ADDRESS = /^0x[\dA-Fa-f]{40}$/
const EMAIL_ADDRESS = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const isEvmAddress = (value: string): boolean =>
  EVM_ADDRESS.test(value.trim())

export const isEmailAddress = (value: string): boolean =>
  EMAIL_ADDRESS.test(value.trim())

/** What a project's collaborator list accepts. */
export const isValidAccountAddress = (value: string): boolean =>
  isEvmAddress(value) || isEmailAddress(value)

/** Normalizes an address for equality checks (trim + lowercase). */
export const normalizeAddress = (address: string): string =>
  address.trim().toLowerCase()

/** Case-insensitive address equality, the check both API and UI rely on. */
export const isSameAddress = (a: string, b: string): boolean =>
  normalizeAddress(a) === normalizeAddress(b)
