import { allSettled, fork, scopeBind } from 'effector'
import { describe, expect, it, vi } from 'vitest'

import { connectTimeTrackerFx, fetchTimeTrackerNonceFx } from './effects'

import {
  $errorMessage,
  $phase,
  initTimeTrackerConnect,
  resetTimeTrackerConnect,
  retryTimeTrackerConnect,
} from './index'

import { $authenticated } from '@/entities/profile'

vi.mock('@/entities/profile', async () => {
  const { createStore } = await import('effector')
  return { $authenticated: createStore(false) }
})
vi.mock('@/shared', () => ({
  showToast: vi.fn(),
  suppressGlobalErrorToast: vi.fn(),
}))
vi.mock('./effects', async () => {
  const { createEffect } = await import('effector')
  return {
    fetchTimeTrackerNonceFx: createEffect<string, { state: string }>(),
    connectTimeTrackerFx: createEffect<string, void>(),
  }
})

describe('time-tracker pairing recovery', () => {
  it('revalidates a failed link and clears its previous error before auth', async () => {
    let attempts = 0
    const pair = vi.fn()
    const scope = fork({
      handlers: [
        [
          fetchTimeTrackerNonceFx,
          async () => {
            attempts += 1
            if (attempts === 1) {
              throw new Error('offline fixture')
            }
            return { state: 'Init' }
          },
        ],
        [connectTimeTrackerFx, pair],
      ],
    })

    await allSettled(initTimeTrackerConnect, { scope, params: 'audit-link' })
    expect(scope.getState($phase)).toBe('error')
    expect(scope.getState($errorMessage)).toBe('offline fixture')

    await allSettled(retryTimeTrackerConnect, { scope })
    expect(attempts).toBe(2)
    expect(scope.getState($phase)).toBe('awaiting_auth')
    expect(scope.getState($errorMessage)).toBeNull()
    expect(pair).not.toHaveBeenCalled()
  })

  it('ignores a nonce response after leaving the pairing page', async () => {
    let resolve!: (value: { state: string }) => void
    const pair = vi.fn()
    const scope = fork({
      values: [[$authenticated, true]],
      handlers: [
        [
          fetchTimeTrackerNonceFx,
          () =>
            new Promise<{ state: string }>((done) => {
              resolve = done
            }),
        ],
        [connectTimeTrackerFx, pair],
      ],
    })
    const loading = allSettled(initTimeTrackerConnect, {
      scope,
      params: 'old-link',
    })

    scopeBind(resetTimeTrackerConnect, { scope })()
    resolve({ state: 'Init' })
    await loading

    expect(scope.getState($phase)).toBe('idle')
    expect(pair).not.toHaveBeenCalled()
  })

  it('does not pair an already connected nonce again', async () => {
    const pair = vi.fn()
    const scope = fork({
      values: [[$authenticated, true]],
      handlers: [
        [fetchTimeTrackerNonceFx, async () => ({ state: 'Connected' })],
        [connectTimeTrackerFx, pair],
      ],
    })

    await allSettled(initTimeTrackerConnect, {
      scope,
      params: 'connected-link',
    })
    expect(scope.getState($phase)).toBe('connected')
    expect(pair).not.toHaveBeenCalled()
  })
})
