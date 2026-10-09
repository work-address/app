import { describe, expect, it } from 'vitest'

import { getSelectedTimeProjectId, isSameTimeSelection } from './time-bulk'

describe('selected-time invoice eligibility', () => {
  const rows = [
    { id: 'a', project: { id: 'project-a' } },
    { id: 'b', project: { id: 'project-a' } },
    { id: 'c', project: { id: 'project-b' } },
    { id: 'missing-project' },
  ]

  it('keeps a sparse selection from one project', () => {
    expect(getSelectedTimeProjectId(rows, ['a', 'b'])).toBe('project-a')
  })

  it('refuses mixed, unknown or incomplete selections', () => {
    expect(getSelectedTimeProjectId(rows, ['a', 'c'])).toBeNull()
    expect(getSelectedTimeProjectId(rows, ['a', 'unknown'])).toBeNull()
    expect(getSelectedTimeProjectId(rows, ['a', 'missing-project'])).toBeNull()
    expect(getSelectedTimeProjectId(rows, [])).toBeNull()
  })

  it('compares operation snapshots without relying on selection order', () => {
    expect(isSameTimeSelection(['a', 'b'], ['b', 'a'])).toBe(true)
    expect(isSameTimeSelection(['a', 'b'], ['a'])).toBe(false)
    expect(isSameTimeSelection(['a'], ['a', 'a'])).toBe(false)
  })
})
