import { AxiosError } from 'axios'
import { allSettled, fork } from 'effector'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { timeQuery } from './time.queries'
import {
  $allTime,
  $isLoadingMoreTime,
  $timeFailed,
  $timeLoading,
} from './time.stores'

const { search } = vi.hoisted(() => ({ search: vi.fn() }))
vi.mock('@/shared', async () => {
  const { runApi, runApiData } = await import('@/shared/lib/api')
  return { baseApi: { timeControllerSearch: search }, runApi, runApiData }
})

beforeEach(() => search.mockReset())

describe('time search reliability', () => {
  it('classifies a returned AxiosError as a failed load, not an empty success', async () => {
    const scope = fork()
    search.mockResolvedValueOnce(
      new AxiosError('Request failed', 'ERR_BAD_RESPONSE'),
    )
    await allSettled(timeQuery.start, { scope, params: { page: 0 } })
    expect(scope.getState(timeQuery.$failed)).toBe(true)
    expect(scope.getState($timeFailed)).toBe(true)
    expect(scope.getState($timeLoading)).toBe(false)
  })

  it('keeps loaded rows and a working first-page state when a later page fails', async () => {
    const scope = fork()
    const row = {
      id: 'a',
      fromAt: '2026-10-01T00:00:00Z',
      toAt: '2026-10-01T00:10:00Z',
    }
    search.mockResolvedValueOnce({ data: [[row], 2] })
    await allSettled(timeQuery.start, { scope, params: { page: 0 } })
    search.mockResolvedValueOnce(new AxiosError('Offline', 'ERR_NETWORK'))
    await allSettled(timeQuery.start, { scope, params: { page: 1 } })
    expect(scope.getState($allTime)).toEqual([row])
    expect(scope.getState($timeFailed)).toBe(false)
    expect(scope.getState($isLoadingMoreTime)).toBe(false)
  })

  it('clears the inline failure after a successful first-page retry', async () => {
    const scope = fork()
    search.mockResolvedValueOnce(new AxiosError('Offline', 'ERR_NETWORK'))
    await allSettled(timeQuery.start, {
      scope,
      params: { page: 0, note: 'design' },
    })
    search.mockResolvedValueOnce({ data: [[], 0] })
    await allSettled(timeQuery.start, {
      scope,
      params: { page: 0, note: 'design' },
    })
    expect(scope.getState($timeFailed)).toBe(false)
    expect(search.mock.calls[1][0].body.filter.note).toBe('design')
  })
})
