import { describe, expect, it, vi } from 'vitest'

import { collectSearchPages } from './collect-search-pages'

describe('collectSearchPages', () => {
  it('includes items beyond the first page before returning an aggregate', async () => {
    const items = Array.from({ length: 251 }, (_, index) => ({
      id: String(index),
    }))
    const fetchPage = vi.fn(
      async (page: number, limit: number) =>
        [items.slice(page * limit, (page + 1) * limit), items.length] as const,
    )

    expect(await collectSearchPages(fetchPage)).toEqual(items)
    expect(fetchPage.mock.calls.map(([page]) => page)).toEqual([0, 1, 2])
  })

  it('does not double-count a repeated id at a page boundary', async () => {
    const pages = [
      [{ id: 'a' }, { id: 'b' }],
      [{ id: 'b' }, { id: 'c' }],
      [{ id: 'd' }],
    ]
    expect(
      await collectSearchPages(async (page) => [pages[page], 4], 2),
    ).toEqual([{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }])
  })

  it('rejects a later-page failure instead of publishing a partial total', async () => {
    const failure = new Error('Connection dropped')
    await expect(
      collectSearchPages(async (page) => {
        if (page > 0) {
          throw failure
        }
        return [[{ id: 'a' }], 2]
      }, 1),
    ).rejects.toBe(failure)
  })

  it('rejects when the server stops adding items before its reported total', async () => {
    const fetchPage = vi.fn(async () => [[{ id: 'a' }], 2] as const)
    await expect(collectSearchPages(fetchPage, 1)).rejects.toThrow(
      'before every item',
    )
    expect(fetchPage).toHaveBeenCalledTimes(2)
  })

  it('rejects a changing count so the UI can retry a coherent aggregate', async () => {
    await expect(
      collectSearchPages(
        async (page) => [[{ id: String(page) }], page === 0 ? 2 : 3],
        1,
      ),
    ).rejects.toThrow('changed while it was being read')
  })

  it('returns a real empty search without requesting an extra page', async () => {
    const fetchPage = vi.fn(async () => [[], 0] as [{ id?: string }[], number])
    expect(await collectSearchPages(fetchPage)).toEqual([])
    expect(fetchPage).toHaveBeenCalledTimes(1)
  })
})
