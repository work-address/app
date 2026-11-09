import { allSettled, fork } from 'effector'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  timeEntryDeleteRequested,
  timeProcessesRemoveRequested,
  timeScreenshotRemoveRequested,
} from './time-dialog.model'

const { remove, removeScreenshot, removeProcesses, confirm } = vi.hoisted(
  () => ({
    remove: vi.fn(),
    removeScreenshot: vi.fn(),
    removeProcesses: vi.fn(),
    confirm: vi.fn(),
  }),
)
vi.mock('@/entities/time', async () => {
  const { createStore } = await import('effector')
  const { createMutation } = await import('@farfetched/core')
  return {
    $allTime: createStore([]),
    deleteTimeMutation: createMutation({ handler: remove }),
    editTimeMutation: createMutation({ handler: vi.fn() }),
    removeTimeProcessesMutation: createMutation({ handler: removeProcesses }),
    removeTimeScreenshotMutation: createMutation({
      handler: removeScreenshot,
    }),
  }
})
vi.mock('@/shared', async () => {
  const { createEffect } = await import('effector')
  return { confirmFx: createEffect(confirm), translate: (key: string) => key }
})

const flows = [
  ['deletes', timeEntryDeleteRequested, remove],
  [
    'removes the screenshot of',
    timeScreenshotRemoveRequested,
    removeScreenshot,
  ],
  ['removes the processes of', timeProcessesRemoveRequested, removeProcesses],
] as const

beforeEach(() => {
  for (const handler of [remove, removeScreenshot, removeProcesses, confirm]) {
    handler.mockReset()
    handler.mockResolvedValue({})
  }
})

describe('a change asked for from the open entry', () => {
  it.each(flows)('%s the entry once confirmed', async (_, requested, sent) => {
    const scope = fork()

    await allSettled(requested, { scope, params: 'a' })

    expect(sent).toHaveBeenCalledWith(['a'])
  })

  it.each(flows)('%s nothing when cancelled', async (_, requested, sent) => {
    confirm.mockRejectedValue(new Error('Cancelled'))
    const scope = fork()

    await allSettled(requested, { scope, params: 'a' })

    expect(sent).not.toHaveBeenCalled()
  })
})
