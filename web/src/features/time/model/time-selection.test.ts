import { describe, expect, it } from 'vitest'

import { getSelectedTimeProjects } from './time-selection'

const ALPHA = { id: 'alpha', title: 'Alpha', text: '', state: 'active' }
const BETA = { id: 'beta', title: 'Beta', text: '', state: 'active' }

describe('getSelectedTimeProjects', () => {
  const entries = [
    { id: 'a1', project: ALPHA },
    { id: 'b1', project: BETA },
    { id: 'a2', project: ALPHA },
    { id: 'orphan' },
  ]

  it('lists each project of the selection once, in the order first met', () => {
    expect(getSelectedTimeProjects(entries, ['a2', 'b1', 'a1'])).toEqual([
      ALPHA,
      BETA,
    ])
  })

  it('ignores entries that are not selected', () => {
    expect(getSelectedTimeProjects(entries, ['a1', 'a2'])).toEqual([ALPHA])
  })

  it('ignores entries without a project and ids no longer in the feed', () => {
    expect(getSelectedTimeProjects(entries, ['orphan', 'gone'])).toEqual([])
  })
})
