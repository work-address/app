export type SearchPage<T> = readonly [readonly T[], number]

/** Reads an entire search before publishing it. Partial aggregates are errors. */
export const collectSearchPages = async <T extends { id?: string }>(
  fetchPage: (page: number, limit: number) => Promise<SearchPage<T>>,
  limit = 100,
): Promise<T[]> => {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error('Search page size must be a positive integer')
  }

  const byId = new Map<string, T>()
  let expectedTotal: number | undefined

  for (let page = 0; ; page += 1) {
    const [items, total] = await fetchPage(page, limit)

    if (!Number.isSafeInteger(total) || total < 0) {
      throw new Error('Search returned an invalid total')
    }
    if (expectedTotal !== undefined && total !== expectedTotal) {
      throw new Error('Search changed while it was being read; retry')
    }
    expectedTotal = total
    const previousSize = byId.size

    for (const item of items) {
      if (!item.id) {
        throw new Error('Search returned an item without an id')
      }
      byId.set(item.id, item)
    }

    if (byId.size === total) {
      return [...byId.values()]
    }
    if (byId.size > total || byId.size === previousSize) {
      throw new Error('Search ended before every item could be read')
    }
  }
}
