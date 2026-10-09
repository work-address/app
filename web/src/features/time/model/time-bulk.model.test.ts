import { allSettled, fork } from 'effector'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  $isTimeBulkPending,
  timeBulkActionRequested,
  timeBulkSelectionClearRequested,
} from './time-bulk.model'
import { $selectedTimeIds, timeSelectionChanged } from './time-selection.model'

const {
  paid,
  removeScreenshots,
  removeProcesses,
  deleteEntries,
  invoice,
  edit,
  confirm,
  toast,
} = vi.hoisted(() => ({
  paid: vi.fn(),
  removeScreenshots: vi.fn(),
  removeProcesses: vi.fn(),
  deleteEntries: vi.fn(),
  invoice: vi.fn(),
  edit: vi.fn(),
  confirm: vi.fn(),
  toast: vi.fn(),
}))
vi.mock('@/entities/time', async () => {
  const { createStore } = await import('effector')
  const { createMutation } = await import('@farfetched/core')
  return {
    $allTime: createStore([
      { id: 'a', project: { id: 'p' } },
      { id: 'b', project: { id: 'p' } },
      { id: 'c', project: { id: 'q' } },
    ]),
    setTimePaidStatusMutation: createMutation({ handler: paid }),
    removeTimeScreenshotMutation: createMutation({
      handler: removeScreenshots,
    }),
    removeTimeProcessesMutation: createMutation({ handler: removeProcesses }),
    deleteTimeMutation: createMutation({ handler: deleteEntries }),
    editTimeMutation: createMutation({ handler: edit }),
  }
})
vi.mock('@/entities/invoice', async () => {
  const { createMutation } = await import('@farfetched/core')
  return { invoiceSelectedTimeMutation: createMutation({ handler: invoice }) }
})
vi.mock('@/shared', async () => {
  const { createEffect } = await import('effector')
  return {
    confirmFx: createEffect(confirm),
    showToastFx: createEffect(toast),
    translate: (key: string) => key,
  }
})

const deferred = () => {
  let resolve!: (value: unknown) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}
const tick = () => new Promise((resolve) => setTimeout(resolve, 0))
const handlers = [
  paid,
  removeScreenshots,
  removeProcesses,
  deleteEntries,
  invoice,
  edit,
]
beforeEach(() => {
  for (const handler of [...handlers, confirm, toast]) {
    handler.mockReset()
  }
  for (const handler of handlers) {
    handler.mockResolvedValue({ id: 'invoice' })
  }
  confirm.mockResolvedValue({})
})

const selectedScope = async () => {
  const scope = fork()
  await allSettled(timeSelectionChanged, {
    scope,
    params: { a: true, b: true },
  })
  return scope
}

describe('time bulk workflow', () => {
  it.each([
    'paid',
    'unpaid',
    'invoice',
    'delete',
    'remove-screenshots',
    'remove-processes',
  ] as const)(
    'clears the accepted selection after %s succeeds',
    async (action) => {
      const scope = await selectedScope()
      await allSettled(timeBulkActionRequested, { scope, params: action })
      expect(scope.getState($selectedTimeIds)).toEqual([])
      expect(scope.getState($isTimeBulkPending)).toBe(false)
      if (action === 'paid' || action === 'unpaid') {
        expect(paid).toHaveBeenCalledWith({
          ids: ['a', 'b'],
          isPaid: action === 'paid',
        })
      }
      if (action === 'invoice') {
        expect(invoice).toHaveBeenCalledWith({
          projectId: 'p',
          timeIds: ['a', 'b'],
        })
      }
    },
  )

  it('captures confirmation IDs and blocks changing selection, clearing, and overlap while confirming', async () => {
    const scope = await selectedScope()
    const choice = deferred()
    confirm.mockReturnValue(choice.promise)
    const first = allSettled(timeBulkActionRequested, {
      scope,
      params: 'delete',
    })
    await tick()
    expect(scope.getState($isTimeBulkPending)).toBe(true)
    const attempts = [
      allSettled(timeSelectionChanged, { scope, params: { c: true } }),
      allSettled(timeBulkSelectionClearRequested, { scope }),
      allSettled(timeBulkActionRequested, { scope, params: 'paid' }),
      allSettled(timeBulkActionRequested, {
        scope,
        params: 'remove-processes',
      }),
    ]
    await tick()
    expect(scope.getState($selectedTimeIds)).toEqual(['a', 'b'])
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(paid).not.toHaveBeenCalled()
    choice.resolve({})
    await Promise.all([first, ...attempts])
    expect(deleteEntries).toHaveBeenCalledWith(['a', 'b'])
    expect(scope.getState($selectedTimeIds)).toEqual([])
  })

  it('keeps selection and performs no mutation after confirmation cancellation', async () => {
    const scope = await selectedScope()
    confirm.mockRejectedValue(new Error('Cancelled'))
    await allSettled(timeBulkActionRequested, {
      scope,
      params: 'remove-screenshots',
    })
    expect(removeScreenshots).not.toHaveBeenCalled()
    expect(scope.getState($selectedTimeIds)).toEqual(['a', 'b'])
    expect(scope.getState($isTimeBulkPending)).toBe(false)
  })

  it('locks all action routes and selection until an invoice request finishes', async () => {
    const scope = await selectedScope()
    const result = deferred()
    invoice.mockReturnValue(result.promise)
    const first = allSettled(timeBulkActionRequested, {
      scope,
      params: 'invoice',
    })
    await tick()
    const attempts = [
      allSettled(timeBulkActionRequested, { scope, params: 'paid' }),
      allSettled(timeBulkActionRequested, { scope, params: 'delete' }),
      allSettled(timeBulkSelectionClearRequested, { scope }),
      allSettled(timeSelectionChanged, { scope, params: { c: true } }),
    ]
    await tick()
    expect(scope.getState($isTimeBulkPending)).toBe(true)
    expect(scope.getState($selectedTimeIds)).toEqual(['a', 'b'])
    expect(paid).not.toHaveBeenCalled()
    expect(confirm).not.toHaveBeenCalled()
    result.resolve({ id: 'invoice' })
    await Promise.all([first, ...attempts])
    expect(scope.getState($selectedTimeIds)).toEqual([])
  })

  it('retains selection for retry when the mutation fails', async () => {
    const scope = await selectedScope()
    paid.mockRejectedValue(new Error('Offline'))
    await allSettled(timeBulkActionRequested, { scope, params: 'paid' })
    expect(scope.getState($selectedTimeIds)).toEqual(['a', 'b'])
    expect(scope.getState($isTimeBulkPending)).toBe(false)
    paid.mockResolvedValue({})
    await allSettled(timeBulkActionRequested, { scope, params: 'paid' })
    expect(scope.getState($selectedTimeIds)).toEqual([])
  })

  it('rejects mixed-project invoicing and allows idle selection clearing', async () => {
    const scope = fork()
    await allSettled(timeSelectionChanged, {
      scope,
      params: { a: true, c: true },
    })
    await allSettled(timeBulkActionRequested, { scope, params: 'invoice' })
    expect(invoice).not.toHaveBeenCalled()
    expect(scope.getState($selectedTimeIds)).toEqual(['a', 'c'])
    await allSettled(timeBulkSelectionClearRequested, { scope })
    expect(scope.getState($selectedTimeIds)).toEqual([])
  })
})
