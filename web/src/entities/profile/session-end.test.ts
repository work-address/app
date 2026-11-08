import { allSettled, fork } from 'effector'
import { describe, expect, it, vi } from 'vitest'

import { loginEthFx } from './eth.model'
import { loginGoogleFx } from './google.model'
import { clearTokensFx, restartAppFx } from './profile.effects'

import { $authenticated, $signedOutOnPurpose, $user, signOut } from './index'

import { routes } from '@/routes'
import { sessionExpired, type baseApi } from '@/shared'

vi.hoisted(() => {
  const storage = new Map<string, string>()

  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  })
  vi.stubGlobal('window', globalThis)
})

const start = (authenticated = true) => {
  const restart = vi.fn()
  const clearTokens = vi.fn()
  const scope = fork({
    values: [
      [$authenticated, authenticated],
      [$user, authenticated ? ({ id: 'first' } as baseApi.User) : null],
    ],
    handlers: [
      [restartAppFx, restart],
      [clearTokensFx, clearTokens],
      [
        loginEthFx,
        () => {
          throw new Error('refused')
        },
      ],
      [
        loginGoogleFx,
        () => {
          throw new Error('refused')
        },
      ],
    ],
  })

  return { scope, restart, clearTokens }
}

describe('the end of a session', () => {
  it('starts the app over at sign-in when the person signs out', async () => {
    const { scope, restart, clearTokens } = start()

    await allSettled(signOut, { scope })

    expect(restart).toHaveBeenCalledOnce()
    expect(restart).toHaveBeenCalledWith(routes.signIn.build())
    expect(clearTokens).toHaveBeenCalled()
    expect(scope.getState($authenticated)).toBe(false)
    expect(scope.getState($user)).toBeNull()
    expect(scope.getState($signedOutOnPurpose)).toBe(true)
  })

  // No path: the reload stays on the page, so sign-in can bring them back to it.
  it('starts the app over in place when the session runs out', async () => {
    const { scope, restart, clearTokens } = start()

    await allSettled(sessionExpired, { scope })

    expect(restart).toHaveBeenCalledOnce()
    expect(restart.mock.calls[0][0]).toBeUndefined()
    expect(clearTokens).toHaveBeenCalled()
    expect(scope.getState($authenticated)).toBe(false)
    expect(scope.getState($user)).toBeNull()
    expect(scope.getState($signedOutOnPurpose)).toBe(false)
  })

  it('counts each session once, however many requests were refused', async () => {
    const { scope, restart } = start()

    await allSettled(sessionExpired, { scope })
    await allSettled(sessionExpired, { scope })

    expect(restart).toHaveBeenCalledOnce()
  })

  // The sign-in page shows the error in place, and a reload would wipe it.
  it('leaves a refused sign-in alone', async () => {
    const { scope, restart } = start(false)

    await allSettled(sessionExpired, { scope })
    await allSettled(loginEthFx, {
      scope,
      params: { signature: 'signature', address: 'address' },
    })
    await allSettled(loginGoogleFx, {
      scope,
      params: { credential: 'credential' },
    } as never)

    expect(restart).not.toHaveBeenCalled()
  })
})
