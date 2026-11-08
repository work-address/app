import { AxiosError, type AxiosAdapter } from 'axios'
import { allSettled, fork } from 'effector'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { clearTokensFx, fetchStatusFx, restartAppFx } from './profile.effects'

import { $authenticated, $user, logout } from './index'

import { sessionExpired } from '@/shared/api/base'
import { client } from '@/shared/api/generated/client.gen'

const { storage } = vi.hoisted(() => {
  const storage = new Map<string, string>()

  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  })
  vi.stubGlobal('window', globalThis)

  return { storage }
})

type Answer = number | 'offline'

const STATUS_RETRY_MS = 15_000

const USER = { id: 'first', address: '0xfirst' }

/**
 * The API as it behaves: status never refuses, and answers empty for a token
 * that identifies nobody. `status` overrides that with an outage.
 */
const network = (answers: { refresh?: Answer; status?: Answer[] } = {}) => {
  const status = [...(answers.status ?? [])]
  const calls = { status: 0, refresh: 0 }

  const adapter: AxiosAdapter = async (config) => {
    const isRefresh = config.url?.endsWith('/auth/refresh')
    calls[isRefresh ? 'refresh' : 'status'] += 1

    const answer = isRefresh
      ? (answers.refresh ?? 200)
      : (status.shift() ?? 200)

    if (answer === 'offline') {
      throw new AxiosError('Network Error', 'ERR_NETWORK', config)
    }

    const response = {
      data:
        !isRefresh && config.headers.Authorization === 'good-access'
          ? USER
          : '',
      status: answer,
      statusText: '',
      config,
      headers: isRefresh
        ? { authorization: 'good-access', 'refresh-token': 'good-refresh' }
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

  return calls
}

const start = () => {
  const restart = vi.fn()
  const clearTokens = vi.fn()
  const loggedOut = vi.fn()
  const scope = fork({
    values: [[$authenticated, true]],
    handlers: [
      [restartAppFx, restart],
      [clearTokensFx, clearTokens],
    ],
  })
  const unwatch = logout.watch(loggedOut)

  return { scope, restart, clearTokens, loggedOut, unwatch }
}

/** Reads the status once, then lets any retry it scheduled come round. */
const readStatus = async (scope: ReturnType<typeof fork>, retries = 0) => {
  const settled = allSettled(fetchStatusFx, { scope }).catch(() => {})

  await vi.advanceTimersByTimeAsync(0)
  for (let retry = 0; retry < retries; retry += 1) {
    await vi.advanceTimersByTimeAsync(STATUS_RETRY_MS)
  }

  return settled
}

describe('reading who is signed in', () => {
  const expired = vi.fn()
  let unwatchExpired: () => void

  beforeEach(() => {
    vi.useFakeTimers()
    storage.clear()
    storage.set('access_token', 'good-access')
    storage.set('refresh_token', 'good-refresh')
    expired.mockClear()
    unwatchExpired = sessionExpired.watch(() => expired())
  })

  afterEach(() => {
    unwatchExpired()
    vi.useRealTimers()
  })

  it('reads the profile with a good token', async () => {
    const calls = network()
    const { scope, unwatch } = start()

    await readStatus(scope)
    unwatch()

    expect(scope.getState($user)).toEqual(USER)
    expect(calls).toEqual({ status: 1, refresh: 0 })
  })

  // Status answers empty rather than 401, so nothing else would renew the token.
  it('renews an expired access token and reads the profile', async () => {
    storage.set('access_token', 'expired-access')
    const calls = network()
    const { scope, restart, unwatch } = start()

    await readStatus(scope)
    unwatch()

    expect(scope.getState($user)).toEqual(USER)
    expect(calls).toEqual({ status: 2, refresh: 1 })
    expect(storage.get('access_token')).toBe('good-access')
    expect(restart).not.toHaveBeenCalled()
  })

  it('ends the session when renewing it is refused', async () => {
    storage.set('access_token', 'expired-access')
    network({ refresh: 401 })
    const { scope, unwatch } = start()

    const settled = allSettled(fetchStatusFx, { scope }).catch(() => {})
    await vi.advanceTimersByTimeAsync(0)

    expect(expired).toHaveBeenCalled()
    expect(storage.has('refresh_token')).toBe(false)
    expect(scope.getState($user)).toBeNull()

    // The reload that follows in the app; here it has to be said.
    const ended = allSettled(logout, { scope })
    await vi.advanceTimersByTimeAsync(STATUS_RETRY_MS)
    await Promise.all([settled, ended])
    unwatch()
  })

  it.each<Answer>([500, 503, 'offline'])(
    'keeps the session through an outage (%s)',
    async (answer) => {
      network({ status: [answer] })
      const { scope, restart, clearTokens, loggedOut, unwatch } = start()

      await readStatus(scope, 1)
      unwatch()

      expect(restart).not.toHaveBeenCalled()
      expect(clearTokens).not.toHaveBeenCalled()
      expect(loggedOut).not.toHaveBeenCalled()
      expect(expired).not.toHaveBeenCalled()
      expect(storage.get('access_token')).toBe('good-access')
      expect(scope.getState($authenticated)).toBe(true)
    },
  )

  it('keeps the session when an outage stops the token being renewed', async () => {
    storage.set('access_token', 'expired-access')
    network({ refresh: 503 })
    const { scope, restart, unwatch } = start()

    const settled = allSettled(fetchStatusFx, { scope }).catch(() => {})
    await vi.advanceTimersByTimeAsync(0)
    network({ refresh: 200 })
    await vi.advanceTimersByTimeAsync(STATUS_RETRY_MS)
    await settled
    unwatch()

    expect(restart).not.toHaveBeenCalled()
    expect(expired).not.toHaveBeenCalled()
    expect(storage.get('refresh_token')).toBe('good-refresh')
    expect(scope.getState($user)).toEqual(USER)
  })

  it('reads the profile once the outage is over', async () => {
    const calls = network({ status: [500, 'offline'] })
    const { scope, unwatch } = start()

    await readStatus(scope, 2)
    unwatch()

    expect(calls.status).toBe(3)
    expect(scope.getState($user)).toEqual(USER)
  })

  // Tokens were renewed and still identify nobody: not a person with no fields.
  it('never takes an empty answer for a profile', async () => {
    storage.set('access_token', 'expired-access')
    const adapterCalls = network()
    const { scope, unwatch } = start()
    let answers = 0

    client.setConfig({
      adapter: async (config) => {
        answers += 1
        adapterCalls.status += 1
        return {
          data: answers === 4 ? USER : '',
          status: 200,
          statusText: '',
          config,
          headers: {},
        }
      },
    })

    const settled = allSettled(fetchStatusFx, { scope }).catch(() => {})
    await vi.advanceTimersByTimeAsync(0)
    expect(scope.getState($user)).toBeNull()
    await vi.advanceTimersByTimeAsync(STATUS_RETRY_MS)
    await settled
    unwatch()

    expect(scope.getState($user)).toEqual(USER)
  })

  it('stops reading after the session has ended', async () => {
    const calls = network({ status: [500] })
    const { scope, unwatch } = start()

    const settled = allSettled(fetchStatusFx, { scope }).catch(() => {})
    await vi.advanceTimersByTimeAsync(0)
    const ended = allSettled(logout, { scope })
    await vi.advanceTimersByTimeAsync(STATUS_RETRY_MS)
    await Promise.all([settled, ended])
    unwatch()

    expect(calls.status).toBe(1)
  })
})
