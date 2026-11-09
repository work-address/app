import { allSettled, fork } from 'effector'
import { describe, expect, it, vi } from 'vitest'

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
  await allSettled(stripEntryOpened, { scope, params: id })
  return scope
}

describe("the screenshot strip's open entry", () => {
  it('closes when that entry is deleted', async () => {
    const { deleteTimeMutation } = await import('@/entities/time')
    const scope = await opened('a')

    await allSettled(deleteTimeMutation.start, { scope, params: ['a'] })

    expect(scope.getState($stripEntryId)).toBeNull()
  })

  it('stays open when another entry is deleted', async () => {
    const { deleteTimeMutation } = await import('@/entities/time')
    const scope = await opened('a')

    await allSettled(deleteTimeMutation.start, { scope, params: ['b'] })

    expect(scope.getState($stripEntryId)).toBe('a')
  })

  it('closes with the dialog, as after a saved edit', async () => {
    const scope = await opened('a')

    await allSettled(timeDialogClosed, { scope })

    expect(scope.getState($stripEntryId)).toBeNull()
  })
})
