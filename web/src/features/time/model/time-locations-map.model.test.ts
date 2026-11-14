import { allSettled, fork } from 'effector'
import { describe, expect, it, vi } from 'vitest'

import { $mapEntryId, mapEntryOpened } from './time-locations-map.model'
import { $stripEntryId, stripEntryOpened } from './time-screenshot-strip.model'
import { timeDialogClosed } from './time-table.model'

const { remove } = vi.hoisted(() => ({ remove: vi.fn() }))
vi.mock('@/entities/time', async () => {
  const { createStore } = await import('effector')
  const { createMutation } = await import('@farfetched/core')
  return {
    $allTime: createStore([]),
    deleteTimeMutation: createMutation({ handler: remove }),
  }
})

const opened = async (id: string) => {
  const scope = fork()
  await allSettled(mapEntryOpened, { scope, params: id })
  return scope
}

describe("the locations map's open entry", () => {
  it('is its own: opening one on the map leaves the screenshot strip shut', async () => {
    const scope = await opened('a')

    expect(scope.getState($mapEntryId)).toBe('a')
    expect(scope.getState($stripEntryId)).toBeNull()

    await allSettled(stripEntryOpened, { scope, params: 'b' })
    expect(scope.getState($mapEntryId)).toBe('a')
  })

  it('closes when that entry is deleted', async () => {
    const { deleteTimeMutation } = await import('@/entities/time')
    const scope = await opened('a')

    await allSettled(deleteTimeMutation.start, { scope, params: ['a'] })

    expect(scope.getState($mapEntryId)).toBeNull()
  })

  it('closes with the dialog, as after a saved edit', async () => {
    const scope = await opened('a')

    await allSettled(timeDialogClosed, { scope })

    expect(scope.getState($mapEntryId)).toBeNull()
  })
})
