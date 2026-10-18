import { allSettled, fork } from 'effector'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { $invoiceSummary } from './list.stores'
import { invoiceQuery, invoiceSummaryQuery } from './queries'
import { $invoiceCanReject, invoiceRejectionRequested } from './rejection.model'

const { reject, read, collect, profileStore } = await vi.hoisted(async () => {
  const { createStore } = await import('effector')
  return {
    reject: vi.fn(),
    read: vi.fn(),
    collect: vi.fn(),
    profileStore: createStore<{ id: string } | null>(null),
  }
})
vi.mock('@/shared', async () => {
  const { runApiData } = await import('@/shared/lib/api')
  return {
    baseApi: { invoiceControllerReject: reject, invoiceControllerRead: read },
    runApiData,
    collectSearchPages: collect,
    getLoadFailureKind: () => 'failed',
  }
})
vi.mock('@/entities/profile', () => ({ $user: profileStore }))
const invoice = {
  id: 'invoice',
  state: 'Requested',
  project: { user: { id: 'owner' } },
  user: { id: 'worker' },
}
beforeEach(() => {
  reject.mockReset()
  read.mockReset()
  collect.mockReset()
})

describe('invoice rejection', () => {
  it('allows the owner and reloads the rejected record', async () => {
    const rejected = {
      ...invoice,
      state: 'REJECTED',
      rejectionReason: 'Correct the period',
    }
    reject.mockResolvedValue({ data: rejected })
    read
      .mockResolvedValueOnce({ data: invoice })
      .mockResolvedValue({ data: rejected })
    const scope = fork({ values: [[profileStore, { id: 'owner' }]] })
    await allSettled(invoiceQuery.start, { scope, params: invoice.id })
    expect(scope.getState($invoiceCanReject)).toBe(true)
    await allSettled(invoiceRejectionRequested, {
      scope,
      params: 'Correct the period',
    })
    expect(reject).toHaveBeenCalledWith({
      path: { id: 'invoice' },
      body: { reason: 'Correct the period' },
    })
    expect(scope.getState(invoiceQuery.$data)?.state).toBe('REJECTED')
    expect(scope.getState($invoiceCanReject)).toBe(false)
  })
  it('refuses issuer, viewer, and already-paid requests in the model', async () => {
    for (const [id, state] of [
      ['worker', 'Requested'],
      ['viewer', 'Requested'],
      ['owner', 'PAID'],
    ]) {
      const scope = fork({ values: [[profileStore, { id }]] })
      read.mockResolvedValue({ data: { ...invoice, state } })
      await allSettled(invoiceQuery.start, { scope, params: invoice.id })
      await allSettled(invoiceRejectionRequested, { scope, params: '' })
    }
    expect(reject).not.toHaveBeenCalled()
  })
  it('excludes rejected invoices from money owed and paid totals', async () => {
    const scope = fork()
    collect.mockResolvedValue([
      { ...invoice, amountCents: '1000' },
      { ...invoice, id: 'rejected', state: 'REJECTED', amountCents: '9000' },
      { ...invoice, id: 'paid', state: 'PAID', amountCents: '2000' },
    ])
    await allSettled(invoiceSummaryQuery.start, { scope, params: {} })
    expect(scope.getState($invoiceSummary)).toEqual({
      requestedCents: 1000,
      requestedCount: 1,
      paidCents: 2000,
      paidCount: 1,
      totalCents: 3000,
      totalCount: 2,
    })
  })
})
