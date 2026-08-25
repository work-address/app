import { AxiosError } from 'axios'

/**
 * A user closing their wallet is not an error worth reporting, so
 * getErrorMessage returns null for it and callers skip the toast.
 *
 * Detection is structural first: EIP-1193 uses code 4001 for a user
 * rejection and ethers v6 reports ACTION_REJECTED, neither of which depends
 * on wording or locale. The literal message is kept only as a fallback for
 * providers that surface neither - it is produced by a wallet library, not by
 * this app, so it can change without warning.
 */
const WALLET_USER_CANCEL_MESSAGE = 'Wallet was not connected'
const EIP_1193_USER_REJECTED = 4001

const isUserRejection = (error: unknown): boolean => {
  if (error === null || typeof error !== 'object') {
    return false
  }

  const { code } = error as { code?: unknown }

  return code === EIP_1193_USER_REJECTED || code === 'ACTION_REJECTED'
}

export function getErrorMessage(
  error: unknown,
  fallback = 'Something went wrong',
): string | null {
  if (isUserRejection(error)) {
    return null
  }

  if (error instanceof AxiosError) {
    const data = error.response?.data

    if (data && typeof data === 'object' && 'message' in data) {
      const message = (data as { message?: unknown }).message

      if (typeof message === 'string' && message.length > 0) {
        return message
      }
    }

    if (error.message) {
      return error.message
    }

    return fallback
  }

  if (error instanceof Error) {
    if (error.message === WALLET_USER_CANCEL_MESSAGE) {
      return null
    }

    return error.message || fallback
  }

  if (typeof error === 'string' && error.length > 0) {
    return error
  }

  return fallback
}
