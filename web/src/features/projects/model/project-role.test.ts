import { describe, expect, it } from 'vitest'

import {
  getViewerOnlyProjectIds,
  isProjectViewerOnly,
  type ProjectMembership,
} from './project-role'

const OWNER = {
  id: 'owner-id',
  address: '0x2222222222222222222222222222222222222222',
}
const WORKER = {
  id: 'worker-id',
  address: '0xAbCdEf0123456789aBcDeF0123456789AbCdEf01',
}
const VIEWER = {
  id: 'viewer-id',
  address: '0x1111111111111111111111111111111111111111',
}

const project = (
  membership: Partial<ProjectMembership> = {},
): ProjectMembership => ({
  user: { id: OWNER.id },
  workerAddresses: [WORKER.address],
  viewerAddresses: [VIEWER.address],
  ...membership,
})

describe('isProjectViewerOnly', () => {
  it('is true for an address on the viewer list alone', () => {
    expect(isProjectViewerOnly(project(), VIEWER)).toBe(true)
  })

  it('is false for a worker, who invoices their own hours', () => {
    expect(isProjectViewerOnly(project(), WORKER)).toBe(false)
  })

  it('is false for the owner', () => {
    expect(isProjectViewerOnly(project(), OWNER)).toBe(false)
  })

  it('lets the worker role win when an address is on both lists', () => {
    const both = project({
      workerAddresses: [VIEWER.address],
      viewerAddresses: [VIEWER.address],
    })

    expect(isProjectViewerOnly(both, VIEWER)).toBe(false)
  })

  it('never demotes the owner, even with their address on the viewer list', () => {
    // The API strips the owner's address from both lists on save, but a row
    // written before that rule could still carry it.
    const listed = project({ viewerAddresses: [OWNER.address] })

    expect(isProjectViewerOnly(listed, OWNER)).toBe(false)
  })

  it('matches addresses case-insensitively, as the API does', () => {
    const shouted = { ...VIEWER, address: VIEWER.address.toUpperCase() }
    const stored = project({
      viewerAddresses: [WORKER.address.toLowerCase(), VIEWER.address],
    })

    expect(isProjectViewerOnly(stored, shouted)).toBe(true)
    expect(isProjectViewerOnly(stored, WORKER)).toBe(false)
  })

  it('shows the action to a signed-out or unloaded user', () => {
    expect(isProjectViewerOnly(project(), null)).toBe(false)
    expect(isProjectViewerOnly(project(), { id: 'x' })).toBe(false)
  })

  it('treats missing lists as empty', () => {
    const bare = project({
      workerAddresses: undefined,
      viewerAddresses: undefined,
    })

    expect(isProjectViewerOnly(bare, VIEWER)).toBe(false)
  })
})

describe('getViewerOnlyProjectIds', () => {
  const projects = [
    { ...project(), id: 'viewed' },
    { ...project({ workerAddresses: [VIEWER.address] }), id: 'worked' },
    { ...project({ user: { id: VIEWER.id } }), id: 'owned' },
    { ...project({ viewerAddresses: [] }), id: 'unlisted' },
    { ...project(), id: undefined },
  ]

  it('lists exactly the projects the member only views', () => {
    expect(getViewerOnlyProjectIds(projects, VIEWER)).toEqual(['viewed'])
  })

  it('lists none for a worker or the owner', () => {
    expect(getViewerOnlyProjectIds(projects, WORKER)).toEqual([])
    expect(getViewerOnlyProjectIds(projects, OWNER)).toEqual([])
  })

  it('lists none before the user has loaded', () => {
    expect(getViewerOnlyProjectIds(projects, null)).toEqual([])
  })
})
