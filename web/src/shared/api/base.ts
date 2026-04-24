import {
  AxiosError,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'

import { authControllerRefresh } from './generated'
import { client } from './generated/client.gen'

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
        const result = await authControllerRefresh({
          headers: {
            'Refresh-Token': refreshToken,
            Authorization: '',
          },
          body: {},
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

        if (originalRequest.headers) {
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

export * as baseApi from './generated'
