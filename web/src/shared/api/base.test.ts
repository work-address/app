import {
  AxiosError,
  type AxiosAdapter,
  type InternalAxiosRequestConfig,
} from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { sessionExpired } from './base'
import { client } from './generated/client.gen'

const { storage } = vi.hoisted(() => {
  const storage = new Map<string, string>()

  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  })

  return { storage }
})

type Answer = number | 'offline'

/** Stands in for the network: what each request gets back. */
const network = (answers: { refresh: Answer; other?: Answer[] }) => {
  const other = [...(answers.other ?? [])]
  const refreshes: InternalAxiosRequestConfig[] = []
  const requests: InternalAxiosRequestConfig[] = []

  const adapter: AxiosAdapter = async (config) => {
    const isRefresh = config.url?.endsWith('/auth/refresh')
    ;(isRefresh ? refreshes : requests).push(config)

    const answer = isRefresh ? answers.refresh : (other.shift() ?? 200)

    if (answer === 'offline') {
      throw new AxiosError('Network Error', 'ERR_NETWORK', config)
    }

    const response = {
      data: {},
      status: answer,
      statusText: '',
      config,
      headers:
        isRefresh && answer === 200
          ? { authorization: 'new-access', 'refresh-token': 'new-refresh' }
          : {},
    }

    if (answer >= 400) {
      throw new AxiosError(
        'failed',
        undefined,
        config,
        undefined,
        response as never,
      )
    }

    return response
  }

  client.setConfig({ adapter })

  return { refreshes, requests }
}

/**
 * How a request through the generated client ends. A hung one is a failure being
 * tested for, so it must not hang the test.
 */
const settle = (url: string) =>
  Promise.race([
    client.get({ url, throwOnError: true }).then(
      () => 'resolved',
      () => 'rejected',
    ),
    new Promise((resolve) => setTimeout(() => resolve('hung'), 200)),
  ])

describe('a request the session no longer answers for', () => {
  const expired = vi.fn()
  let unwatch: () => void

  beforeEach(() => {
    storage.clear()
    storage.set('access_token', 'old-access')
    storage.set('refresh_token', 'old-refresh')
    expired.mockClear()
    unwatch = sessionExpired.watch(() => expired())
  })

  afterEach(() => unwatch())

  it('refreshes and retries while the refresh token is good', async () => {
    const { refreshes, requests } = network({ refresh: 200, other: [401] })

    expect(await settle('/invoice')).toBe('resolved')

    expect(refreshes).toHaveLength(1)
    expect(requests[1].headers.Authorization).toBe('new-access')
    expect(storage.get('refresh_token')).toBe('new-refresh')
    expect(expired).not.toHaveBeenCalled()
  })

  it('ends the session when the refresh is refused', async () => {
    const { refreshes } = network({ refresh: 401, other: [401] })

    expect(await settle('/invoice')).toBe('rejected')

    expect(refreshes).toHaveLength(1)
    expect(storage.has('access_token')).toBe(false)
    expect(storage.has('refresh_token')).toBe(false)
    expect(expired).toHaveBeenCalled()
  })

  it('settles every request waiting on a refused refresh', async () => {
    const { refreshes } = network({ refresh: 401, other: [401, 401, 401] })

    const results = await Promise.all(
      ['/invoice', '/project', '/time'].map((url) => settle(url)),
    )

    expect(results).toEqual(['rejected', 'rejected', 'rejected'])
    expect(refreshes).toHaveLength(1)
  })

  it.each<Answer>([500, 503, 'offline'])(
    'keeps the session when the refresh only failed to run (%s)',
    async (answer) => {
      network({ refresh: answer, other: [401] })

      expect(await settle('/invoice')).toBe('rejected')

      expect(storage.get('access_token')).toBe('old-access')
      expect(storage.get('refresh_token')).toBe('old-refresh')
      expect(expired).not.toHaveBeenCalled()
    },
  )

  it('ends the session when there is no refresh token to try', async () => {
    storage.delete('refresh_token')
    const { refreshes } = network({ refresh: 200, other: [401] })

    expect(await settle('/invoice')).toBe('rejected')

    expect(refreshes).toHaveLength(0)
    expect(expired).toHaveBeenCalled()
  })

  it('leaves other failures to their callers', async () => {
    network({ refresh: 200, other: [403] })

    expect(await settle('/invoice')).toBe('rejected')

    expect(storage.get('access_token')).toBe('old-access')
    expect(expired).not.toHaveBeenCalled()
  })
})
