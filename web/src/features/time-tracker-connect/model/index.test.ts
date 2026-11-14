import { allSettled, fork, scopeBind } from 'effector'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { connectTimeTrackerFx, fetchTimeTrackerNonceFx } from './effects'

import {
  $errorMessage,
  $openedByWebsite,
  $phase,
  confirmTimeTrackerConnect,
  initTimeTrackerConnect,
  resetTimeTrackerConnect,
  retryTimeTrackerConnect,
  timeTrackerConnectOpenedBy,
} from './index'

import { $authenticated } from '@/entities/profile'
import { showToast } from '@/shared'

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

// A pairing link is easy to send to someone else: opening one must never sign
// its sender in as the reader. Only the reader's click pairs.
describe("pairing only on the reader's click", () => {
  it('asks a signed-in reader instead of pairing the link', async () => {
    const pair = vi.fn()
    const scope = fork({
      values: [[$authenticated, true]],
      handlers: [
        [fetchTimeTrackerNonceFx, async () => ({ state: 'Init' })],
        [connectTimeTrackerFx, pair],
      ],
    })

    await allSettled(initTimeTrackerConnect, { scope, params: 'sent-link' })
    expect(scope.getState($phase)).toBe('awaiting_pair')
    expect(pair).not.toHaveBeenCalled()

    await allSettled(confirmTimeTrackerConnect, { scope })
    expect(pair).toHaveBeenCalledOnce()
    expect(pair).toHaveBeenCalledWith('sent-link')
    expect(scope.getState($phase)).toBe('connected')
  })

  it('asks after signing in on the page, and pairs nothing before', async () => {
    const pair = vi.fn()
    const scope = fork({
      handlers: [
        [fetchTimeTrackerNonceFx, async () => ({ state: 'Init' })],
        [connectTimeTrackerFx, pair],
      ],
    })

    await allSettled(initTimeTrackerConnect, { scope, params: 'a-link' })
    expect(scope.getState($phase)).toBe('awaiting_auth')
    await allSettled($authenticated, { scope, params: true })
    expect(scope.getState($phase)).toBe('awaiting_pair')
    expect(pair).not.toHaveBeenCalled()
  })

  it('pairs nothing on a click while signed out', async () => {
    const pair = vi.fn()
    const scope = fork({
      handlers: [
        [fetchTimeTrackerNonceFx, async () => ({ state: 'Init' })],
        [connectTimeTrackerFx, pair],
      ],
    })

    await allSettled(initTimeTrackerConnect, { scope, params: 'a-link' })
    await allSettled(confirmTimeTrackerConnect, { scope })
    expect(pair).not.toHaveBeenCalled()
  })
})

describe('announcing a finished pairing', () => {
  // The marker the model writes after pairing needs a storage to write to.
  vi.stubGlobal('localStorage', { setItem: vi.fn(), getItem: vi.fn() })

  beforeEach(() => {
    vi.mocked(showToast).mockClear()
  })

  const pairAs = async (opener: 'website' | 'tracker') => {
    const scope = fork({
      values: [[$authenticated, true]],
      handlers: [
        [fetchTimeTrackerNonceFx, async () => ({ state: 'Init' })],
        [connectTimeTrackerFx, async () => {}],
      ],
    })

    await allSettled(timeTrackerConnectOpenedBy, { scope, params: opener })
    await allSettled(initTimeTrackerConnect, { scope, params: 'a-link' })
    await allSettled(confirmTimeTrackerConnect, { scope })

    return scope
  }

  it('tells a tracker user their tracker is connected', async () => {
    const scope = await pairAs('tracker')

    expect(scope.getState($phase)).toBe('connected')
    expect(showToast).toHaveBeenCalledOnce()
  })

  it('stays quiet for a website sign-in, whose tab is about to close', async () => {
    const scope = await pairAs('website')

    expect(scope.getState($phase)).toBe('connected')
    expect(scope.getState($openedByWebsite)).toBe(true)
    expect(showToast).not.toHaveBeenCalled()
  })
})
