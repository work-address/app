import {
  AxiosError,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'
import i18n from 'i18next'

import { authControllerRefresh } from './generated'
import { client } from './generated/client.gen'

import { getErrorMessage } from '@/shared/lib/get-error-message'
import { showToast } from '@/shared/lib/sonner'

const ACCESS_TOKEN_KEY = 'access_token'
const REFRESH_TOKEN_KEY = 'refresh_token'

client.setConfig({
  baseURL: import.meta.env.VITE_API_URL,
})

// Request interceptor - добавляем access token в заголовки
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

// Response interceptor - обрабатываем 401 и обновляем токен
client.instance.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY)

      if (!refreshToken) {
        return Promise.reject(error)
      }

      try {
        if (!refreshPromise) {
          refreshPromise = refreshTokens(refreshToken).finally(() => {
            refreshPromise = null
          })
        }

        const newAccessToken = await refreshPromise

        if (originalRequest.headers && newAccessToken) {
          originalRequest.headers.Authorization = newAccessToken
        }

        return client.instance(originalRequest)
      } catch (refreshError) {
        localStorage.removeItem(ACCESS_TOKEN_KEY)
        localStorage.removeItem(REFRESH_TOKEN_KEY)
        throw refreshError
      }
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
 * refresh has already given up, and that path signs the user out and reports
 * itself. Previously only 400 and 5xx were covered, so 403/404/409/422/429
 * failed completely silently for any caller without its own handler.
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
        if (suppressedErrors.has(error)) {
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
