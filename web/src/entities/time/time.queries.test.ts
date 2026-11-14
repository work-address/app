import { AxiosError } from 'axios'
import { allSettled, fork } from 'effector'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  recentLocationsQuery,
  recentScreenshotsQuery,
  timeAgentRunsQuery,
  timeQuery,
} from './time.queries'
import {
  $allTime,
  $isLoadingMoreTime,
  $timeFailed,
  $timeLoading,
} from './time.stores'

const { search, agentSearch, remove, removeLocations } = vi.hoisted(() => ({
  search: vi.fn(),
  agentSearch: vi.fn(),
  remove: vi.fn(),
  removeLocations: vi.fn(),
}))
vi.mock('./ui', () => ({ TimeEmptyState: () => null }))
vi.mock('@/shared', async () => {
  const { runApi, runApiData } = await import('@/shared/lib/api')
  const { createStore } = await import('effector')
  return {
    $breakpoints: createStore({ isDesktop: true }),
    showToast: vi.fn(),
    suppressGlobalErrorToast: vi.fn(),
    baseApi: {
      timeControllerSearch: search,
      timeControllerDelete: remove,
      timeControllerRemoveLocations: removeLocations,
      agentControllerSearch: agentSearch,
    },
    runApi,
    runApiData,
  }
})

// Braces matter: a function returned from here is run as a cleanup.
beforeEach(() => {
  search.mockReset()
  remove.mockReset()
  removeLocations.mockReset()
})

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

describe('agent runs of an entry', () => {
  it("asks for the project's runs over the entry's period and returns the rows", async () => {
    const scope = fork()
    const params = {
      projectId: 'project',
      fromAt: '2026-10-24T00:40:00.000Z',
      toAt: '2026-10-24T00:50:00.000Z',
    }
    const runs = [
      {
        id: 'run',
        userId: 'u',
        product: 'codex',
        fromAt: params.fromAt,
        toAt: params.toAt,
        status: 'completed',
      },
    ]
    agentSearch.mockResolvedValueOnce({ data: [runs, 1] })
    await allSettled(timeAgentRunsQuery.start, { scope, params })
    expect(agentSearch).toHaveBeenCalledWith({ body: params })
    expect(scope.getState(timeAgentRunsQuery.$data)).toEqual(runs)
  })
})

describe('the list after entries are deleted', () => {
  const row = (id: string) => ({
    id,
    fromAt: '2026-10-01T00:00:00Z',
    toAt: '2026-10-01T00:10:00Z',
  })
  // What the server holds, newest first, read two to a page by offset.
  const serve = (held: { current: string[] }) =>
    search.mockImplementation(async ({ body }: { body: { page: number } }) => ({
      data: [
        held.current.slice(body.page * 2, body.page * 2 + 2).map(row),
        held.current.length,
      ],
    }))
  const ids = (scope: ReturnType<typeof fork>) =>
    scope.getState($allTime).map((item) => item.id)

  it('loads the next page without skipping the rows that moved up', async () => {
    const { deleteTimeMutation, loadMoreTime } = await import('./index')
    const held = { current: ['a', 'b', 'c', 'd', 'e', 'f'] }
    serve(held)
    remove.mockImplementation(async ({ body }: { body: { ids: string[] } }) => {
      held.current = held.current.filter((id) => !body.ids.includes(id))
      return { data: {} }
    })
    const scope = fork()

    await allSettled(timeQuery.start, { scope, params: { page: 0 } })
    await allSettled(deleteTimeMutation.start, { scope, params: ['a'] })
    expect(ids(scope)).toEqual(['b', 'c'])

    await allSettled(loadMoreTime, { scope })
    expect(ids(scope)).toEqual(['b', 'c', 'd', 'e'])
  })

  it('reads the loaded pages again on "load more" when the reload failed', async () => {
    const { deleteTimeMutation, loadMoreTime } = await import('./index')
    const held = { current: ['a', 'b', 'c', 'd', 'e', 'f'] }
    serve(held)
    remove.mockImplementation(async ({ body }: { body: { ids: string[] } }) => {
      held.current = held.current.filter((id) => !body.ids.includes(id))
      search.mockResolvedValueOnce(new AxiosError('Offline', 'ERR_NETWORK'))
      return { data: {} }
    })
    const scope = fork()

    await allSettled(timeQuery.start, { scope, params: { page: 0 } })
    await allSettled(deleteTimeMutation.start, { scope, params: ['a'] })
    expect(ids(scope)).toEqual(['b'])

    await allSettled(loadMoreTime, { scope })
    expect(ids(scope)).toEqual(['b', 'c', 'd', 'e'])
  })
})

describe('the screenshot strip after an entry changes', () => {
  const asked = { fromAt: 'from', toAt: 'to', projectIds: ['p'], userIds: [] }
  const shot = (id: string) => ({ id, screenshot: 'data' })

  it('is read again with what it was last asked, and stays shown meanwhile', async () => {
    const { deleteTimeMutation, $recentScreenshotsShown } = await import(
      './index'
    )
    const scope = fork()
    search.mockResolvedValueOnce({ data: [[shot('a'), shot('b')], 2] })
    await allSettled(recentScreenshotsQuery.start, { scope, params: asked })

    let answer!: (value: unknown) => void
    search.mockReturnValueOnce(
      new Promise((resolve) => {
        answer = resolve
      }),
    )
    remove.mockResolvedValueOnce({ data: {} })
    const settled = allSettled(deleteTimeMutation.start, {
      scope,
      params: ['a'],
    })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(search.mock.calls[1][0].body.filter).toMatchObject({
      withScreenshots: true,
      ...asked,
    })
    expect(scope.getState($recentScreenshotsShown)).toBe(true)
    expect(scope.getState(recentScreenshotsQuery.$data)).toHaveLength(2)

    answer({ data: [[shot('b')], 1] })
    await settled
    expect(scope.getState(recentScreenshotsQuery.$data)).toEqual([shot('b')])
  })

  it('is left alone when it was never loaded', async () => {
    const { deleteTimeMutation } = await import('./index')
    const scope = fork()
    remove.mockResolvedValueOnce({ data: {} })

    await allSettled(deleteTimeMutation.start, { scope, params: ['a'] })

    expect(search).not.toHaveBeenCalled()
  })
})

describe("the dashboard's map", () => {
  const asked = {
    fromAt: 'from',
    toAt: 'to',
    projectIds: ['p'],
    userIds: ['u'],
  }
  const phone = (id: string) => ({ id, source: 'mobile', locations: [] })

  it('asks for the newest phone time under the same filter', async () => {
    const scope = fork()
    search.mockResolvedValueOnce({ data: [[phone('a')], 1] })

    await allSettled(recentLocationsQuery.start, { scope, params: asked })

    expect(search.mock.calls[0][0].body).toMatchObject({
      filter: { ...asked, source: 'mobile' },
      sort: { fromAt: 'DESC' },
    })
    expect(scope.getState(recentLocationsQuery.$data)).toEqual([phone('a')])
  })

  it("is read again after an entry's location is removed, and stays shown meanwhile", async () => {
    const { removeTimeLocationsMutation, $recentLocationsShown } = await import(
      './index'
    )
    const scope = fork()
    search.mockResolvedValueOnce({ data: [[phone('a'), phone('b')], 2] })
    await allSettled(recentLocationsQuery.start, { scope, params: asked })

    let answer!: (value: unknown) => void
    search.mockReturnValueOnce(
      new Promise((resolve) => {
        answer = resolve
      }),
    )
    removeLocations.mockResolvedValueOnce({ data: {} })
    const settled = allSettled(removeTimeLocationsMutation.start, {
      scope,
      params: ['a'],
    })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(search.mock.calls[1][0].body.filter).toMatchObject({
      ...asked,
      source: 'mobile',
    })
    expect(scope.getState($recentLocationsShown)).toBe(true)

    answer({ data: [[phone('b')], 1] })
    await settled
    expect(scope.getState(recentLocationsQuery.$data)).toEqual([phone('b')])
  })
})
