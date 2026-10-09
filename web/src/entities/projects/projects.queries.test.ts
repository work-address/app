import { AxiosError } from 'axios'
import { allSettled, fork } from 'effector'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { projectsQuery, projectsStatsQuery } from './projects.queries'
import { $projectsFailed, $projectsStatsFailed } from './projects.stores'

const { totals, search, suppressed } = vi.hoisted(() => ({
  totals: vi.fn(),
  search: vi.fn(),
  suppressed: vi.fn(),
}))
vi.mock('@/shared', async () => {
  const { runApiData } = await import('@/shared/lib/api')
  const { collectSearchPages } = await import(
    '@/shared/lib/collect-search-pages'
  )
  return {
    baseApi: {
      timeControllerGetTotals: totals,
      projectControllerSearch: search,
    },
    runApiData,
    collectSearchPages,
    suppressGlobalErrorToast: suppressed,
  }
})

beforeEach(() => {
  totals.mockReset()
  search.mockReset()
  suppressed.mockReset()
})

describe('project totals reliability', () => {
  it('suppresses every parallel request error beside the one inline failure', async () => {
    const scope = fork()
    const errors = Array.from(
      { length: 4 },
      (_, index) => new AxiosError(`Offline ${index}`, 'ERR_NETWORK'),
    )
    for (const error of errors) {
      totals.mockResolvedValueOnce(error)
    }
    await allSettled(projectsStatsQuery.start, {
      scope,
      params: ['a', 'b', 'c', 'd'],
    })
    expect(scope.getState($projectsStatsFailed)).toBe(true)
    expect(suppressed).toHaveBeenCalledTimes(4)
    for (const error of errors) {
      expect(suppressed).toHaveBeenCalledWith(error)
    }
  })
  it('keeps a totals failure independent from the successfully loaded projects', async () => {
    const scope = fork()
    search.mockResolvedValueOnce({
      data: [[{ id: 'a', title: 'Project A' }], 1],
    })
    await allSettled(projectsQuery.start, { scope })
    totals.mockResolvedValueOnce(new AxiosError('Offline', 'ERR_NETWORK'))
    await allSettled(projectsStatsQuery.start, { scope, params: ['a'] })
    expect(scope.getState($projectsFailed)).toBe(false)
    expect(scope.getState($projectsStatsFailed)).toBe(true)
    expect(scope.getState(projectsQuery.$data)?.items).toHaveLength(1)
  })

  it('rejects an aggregate when one project fails instead of pricing it at zero', async () => {
    const scope = fork()
    totals.mockResolvedValueOnce({ data: [{ projectId: 'a', minutes: 60 }] })
    totals.mockResolvedValueOnce(
      new AxiosError('Request failed', 'ERR_BAD_RESPONSE'),
    )
    await allSettled(projectsStatsQuery.start, { scope, params: ['a', 'b'] })
    expect(scope.getState(projectsStatsQuery.$failed)).toBe(true)
    expect(scope.getState(projectsStatsQuery.$data)).toBeNull()
  })

  it('clears the totals failure when the retry succeeds', async () => {
    const scope = fork()
    totals.mockResolvedValueOnce(new AxiosError('Offline', 'ERR_NETWORK'))
    await allSettled(projectsStatsQuery.start, { scope, params: ['a'] })
    totals.mockResolvedValueOnce({ data: [] })
    await allSettled(projectsStatsQuery.start, { scope, params: ['a'] })
    expect(scope.getState($projectsStatsFailed)).toBe(false)
    expect(scope.getState(projectsStatsQuery.$data)).toEqual([])
  })
})
