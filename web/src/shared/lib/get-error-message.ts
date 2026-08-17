import { AxiosError } from 'axios'

const WALLET_USER_CANCEL_MESSAGE = 'Wallet was not connected'

export function getErrorMessage(
  error: unknown,
  fallback = 'Something went wrong',
): string | null {
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
