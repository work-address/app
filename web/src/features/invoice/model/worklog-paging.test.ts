import { describe, expect, it } from 'vitest'

import { nextWorklogCount, WORKLOG_PAGE_ROWS } from './worklog-paging'

describe('nextWorklogCount', () => {
  it('adds a page while more than a page remains', () => {
    expect(nextWorklogCount(WORKLOG_PAGE_ROWS, 100)).toBe(2 * WORKLOG_PAGE_ROWS)
  })

  it('stops at the total rather than overshooting it', () => {
    expect(nextWorklogCount(WORKLOG_PAGE_ROWS, 30)).toBe(30)
    expect(nextWorklogCount(30, 30)).toBe(30)
  })
})
