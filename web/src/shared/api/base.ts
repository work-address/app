import {
  AxiosError,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'
import { createEvent } from 'effector'
import i18n from 'i18next'

import { authControllerRefresh } from './generated'
import { client } from './generated/client.gen'

import { getErrorMessage } from '@/shared/lib/get-error-message'
import { showToast } from '@/shared/lib/sonner'

const ACCESS_TOKEN_KEY = 'access_token'
const REFRESH_TOKEN_KEY = 'refresh_token'

/**
 * The API no longer accepts this session, and nothing here can win it back. Also
 * fires for a refused request from someone with no session at all, such as a
 * failed sign-in, so whoever listens decides whether there was one to end.
 */
export const sessionExpired = createEvent()

client.setConfig({
  baseURL: import.meta.env.VITE_API_URL,
})

client.instance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY)

    if (accessToken && config.headers) {
      config.headers.Authorization = accessToken
    }

    return config
  },
)

// Single-flight refresh: concurrent 401s share one refresh request so a
// rotating refresh token isn't consumed multiple times in parallel.
let refreshPromise: Promise<string | undefined> | null = null

const refreshTokens = async (refreshToken: string) => {
  const result = await authControllerRefresh({
    headers: {
      'Refresh-Token': refreshToken,
      Authorization: '',
    },
    body: { refreshToken },
  })

  if (result instanceof AxiosError) {
    throw result
  }

  const newAccessToken = result.headers?.authorization
  const newRefreshToken = result.headers?.['refresh-token']

  if (newAccessToken) {
    localStorage.setItem(ACCESS_TOKEN_KEY, newAccessToken)
  }
  if (newRefreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, newRefreshToken)
  }

  return newAccessToken
}

/**
 * Trades the refresh token for a new pair. Rejects when it can't: a refusal also
 * ends the session, while an outage says nothing about the tokens, so they stay
 * for whatever is retried next.
 */
export const renewSession = async () => {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY)

  if (!refreshToken) {
    sessionExpired()
    throw new Error('There is no session to renew')
  }

  try {
    refreshPromise ??= refreshTokens(refreshToken).finally(() => {
      refreshPromise = null
    })

    return await refreshPromise
  } catch (refreshError) {
    if (
      refreshError instanceof AxiosError &&
      refreshError.response?.status === 401
    ) {
      localStorage.removeItem(ACCESS_TOKEN_KEY)
      localStorage.removeItem(REFRESH_TOKEN_KEY)
      sessionExpired()
    }
    throw refreshError
  }
}

client.instance.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean
    }

    // The refresh's own refusal goes back to refreshTokens: waiting here for the
    // refresh to finish would have it wait on itself, along with every request
    // queued behind it, and none of them would ever settle.
    if (originalRequest.url?.endsWith('/auth/refresh')) {
      return Promise.reject(error)
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      if (!localStorage.getItem(REFRESH_TOKEN_KEY)) {
        sessionExpired()
        return Promise.reject(error)
      }

      const newAccessToken = await renewSession()

      if (originalRequest.headers && newAccessToken) {
        originalRequest.headers.Authorization = newAccessToken
      }

      return client.instance(originalRequest)
    }

    return Promise.reject(error)
  },
)

// Errors that a caller already surfaced with its own, more specific message
// (see suppressGlobalErrorToast below) so the generic handler doesn't also
// show a second, redundant toast for the same failure.
const suppressedErrors = new WeakSet<object>()

export function suppressGlobalErrorToast(error: unknown): void {
  if (error !== null && typeof error === 'object') {
    suppressedErrors.add(error)
  }
}

/**
 * Every failing status gets a generic toast except 401, which belongs to the
 * refresh/logout flow above: a 401 only reaches this interceptor once the
 * refresh has already given up, and that path signs the user out. Previously
 * only 400 and 5xx were covered, so 403/404/409/422/429 failed completely
 * silently for any caller without its own handler.
 */
const isGloballyHandledStatus = (status: number) =>
  status >= 400 && status !== 401

// Global exceptions interceptor - any failing response not already handled by
// a caller (via suppressGlobalErrorToast) gets a generic error toast, so a
// backend failure is never silent by default. Registered as a separate
// interceptor (rather than folded into the 401 handler above) so it only
// sees errors the 401 refresh flow didn't already resolve, and runs on a
// macrotask delay so a same-tick `.finished.failure` watcher has a chance to
// call suppressGlobalErrorToast() first.
client.instance.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError) => {
    const status = error.response?.status

    if (status !== undefined && isGloballyHandledStatus(status)) {
      setTimeout(() => {
        // Callers usually see the response body rather than the AxiosError -
        // the generated client hands that back as the failure - so a body
        // marked as handled counts too.
        const body = error.response?.data

        if (
          suppressedErrors.has(error) ||
          (body !== null &&
            typeof body === 'object' &&
            suppressedErrors.has(body))
        ) {
          return
        }

        const message = getErrorMessage(
          error,
          i18n.t('common.errors.unexpected'),
        )

        if (message) {
          showToast('error', { message, position: 'top-center' })
        }
      }, 0)
    }

    return Promise.reject(error)
  },
)

export * as baseApi from './generated'
